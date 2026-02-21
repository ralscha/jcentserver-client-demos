import {Centrifuge, TransportEndpoint} from 'centrifuge';
import * as maptilersdk from '@maptiler/sdk';
import '@maptiler/sdk/dist/maptiler-sdk.css';

maptilersdk.config.apiKey = import.meta.env.VITE_MAPTILER_API_KEY;

interface LatLng {
    lat: number;
    lng: number;
}

function transports(): TransportEndpoint[] {
    return [
        {transport: 'websocket', endpoint: `ws://${import.meta.env.VITE_CENTRIFUGO_BASE_ADDRESS}/connection/websocket`},
        {transport: 'http_stream', endpoint: `http://${import.meta.env.VITE_CENTRIFUGO_BASE_ADDRESS}/connection/http_stream`},
        {transport: 'sse', endpoint: `http://${import.meta.env.VITE_CENTRIFUGO_BASE_ADDRESS}/connection/sse`}
    ];
}

async function main() {
    const map = new maptilersdk.Map({
        container: 'map',
        style: maptilersdk.MapStyle.STREETS,
        center: [7.444608, 46.947922],
        zoom: 13
    });

    await new Promise<void>((resolve) => {
        map.on('load', () => resolve());
    });

    let blueMarker: maptilersdk.Marker | null = null;
    let redMarker: maptilersdk.Marker | null = null;

    function moveCar(color: 'blue' | 'red', latLng: LatLng) {
        const lngLat: [number, number] = [latLng.lng, latLng.lat];
        if (color === 'blue') {
            if (!blueMarker) {
                const el = document.createElement('div');
                el.style.width = '32px';
                el.style.height = '32px';
                el.style.background = 'blue';
                el.style.borderRadius = '50%';
                el.style.border = '2px solid white';
                blueMarker = new maptilersdk.Marker({element: el})
                    .setLngLat(lngLat)
                    .addTo(map);
            } else {
                blueMarker.setLngLat(lngLat);
            }
        } else {
            if (!redMarker) {
                const el = document.createElement('div');
                el.style.width = '32px';
                el.style.height = '32px';
                el.style.background = 'red';
                el.style.borderRadius = '50%';
                el.style.border = '2px solid white';
                redMarker = new maptilersdk.Marker({element: el})
                    .setLngLat(lngLat)
                    .addTo(map);
            } else {
                redMarker.setLngLat(lngLat);
            }
        }
    }

    const response = await fetch(`${import.meta.env.VITE_SERVER_URL}/centrifugo-token`);
    const token = await response.text();

    const centrifuge = new Centrifuge(transports(), {token});

    const blueSubscription = centrifuge.newSubscription('map.blue');
    blueSubscription.on('publication', ctx => moveCar('blue', ctx.data as LatLng));
    blueSubscription.subscribe();

    const redSubscription = centrifuge.newSubscription('map.red');
    redSubscription.on('publication', ctx => moveCar('red', ctx.data as LatLng));
    redSubscription.subscribe();

    centrifuge.connect();
}

main().catch(console.error);
