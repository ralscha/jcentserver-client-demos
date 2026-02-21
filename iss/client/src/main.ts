import satIconUrl from './saticon.gif'
import {Centrifuge, TransportEndpoint} from 'centrifuge';
import * as maptilersdk from '@maptiler/sdk';
import '@maptiler/sdk/dist/maptiler-sdk.css';

maptilersdk.config.apiKey = import.meta.env.VITE_MAPTILER_API_KEY;

let centered = false;
let issMarker: maptilersdk.Marker | null = null;
let flightPath: [number, number][] = [];

async function main() {
    const map = new maptilersdk.Map({
        container: 'map',
        style: maptilersdk.MapStyle.SATELLITE,
        center: [0, 0],
        zoom: 4
    });

    await new Promise<void>((resolve) => {
        map.on('load', () => resolve());
    });

    const markerElement = document.createElement('img');
    markerElement.src = satIconUrl;
    markerElement.alt = 'ISS';
    markerElement.style.width = '32px';
    markerElement.style.height = '32px';

    issMarker = new maptilersdk.Marker({element: markerElement})
        .setLngLat([0, 0])
        .addTo(map);

    const token = await fetchCentrifugoToken();
    // const userId = extractUserIdFromToken(token);

    const centrifuge = new Centrifuge(transports(), {token});

    // server side subscription
    // centrifuge.on('publication', ctx => updateMarker(map, ctx.data));


    // client side subscription
    const sub = centrifuge.newSubscription('iss');
    sub.on('publication', ctx => updateMarker(map, ctx.data));
    sub.subscribe();


    centrifuge.connect();

    // server side subscription. run after connecting to the server
    // await subscribe(userId);

}

function transports(): TransportEndpoint[] {
    return [
        {
            transport: 'websocket',
            endpoint: `ws://${import.meta.env.VITE_CENTRIFUGO_BASE_ADDRESS}/connection/websocket`
        },
        {
            transport: 'http_stream',
            endpoint: `http://${import.meta.env.VITE_CENTRIFUGO_BASE_ADDRESS}/connection/http_stream`
        },
        {
            transport: 'sse',
            endpoint: `http://${import.meta.env.VITE_CENTRIFUGO_BASE_ADDRESS}/connection/sse`
        }
    ];
}

// function extractUserIdFromToken(token: string): string {
//     const payload = token.split('.')[1];
//     const decodedPayload = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
//     const jsonPayload = JSON.parse(decodedPayload);
//     return jsonPayload.sub;
// }

async function fetchCentrifugoToken(): Promise<string> {
    const response = await fetch(`${import.meta.env.VITE_SERVER_URL}/centrifugo-token`);
    if (!response.ok) {
        throw new Error(`Failed to fetch centrifugo token: ${response.status} ${response.statusText}`);
    }

    return await response.text();
}

// async function subscribe(userId: string): Promise<void> {
//     const response = await fetch(`${import.meta.env.VITE_SERVER_URL}/subscribe`, {
//         method: 'POST',
//         headers: {
//             'Content-Type': 'application/json'
//         },
//         body: JSON.stringify({userId})
//     });
//     if (!response.ok) {
//         throw new Error(`Failed to subscribe: ${response.status} ${response.statusText}`);
//     }
//     return;
// }

function updateMarker(map: maptilersdk.Map, position: { latitude: string, longitude: string }) {
    const lng = parseFloat(position.longitude);
    const lat = parseFloat(position.latitude);
    const newPosition: [number, number] = [lng, lat];

    if (issMarker) {
        issMarker.setLngLat(newPosition);
    }

    if (!centered) {
        centered = true;
        map.easeTo({center: newPosition});
    }

    if (flightPath.length >= 100) {
        flightPath.shift();
    }
    flightPath.push(newPosition);

    if (flightPath.length > 1) {
        const flightPathData = {
            type: 'Feature' as const,
            properties: {},
            geometry: {
                type: 'LineString' as const,
                coordinates: flightPath
            }
        };

        if (map.getSource('flightpath')) {
            const source = map.getSource('flightpath') as maptilersdk.GeoJSONSource;
            source.setData(flightPathData);
        } else {
            map.addSource('flightpath', {
                type: 'geojson',
                data: flightPathData
            });

            map.addLayer({
                id: 'flightpath-layer',
                type: 'line',
                source: 'flightpath',
                layout: {
                    'line-join': 'round',
                    'line-cap': 'round'
                },
                paint: {
                    'line-color': '#ffff00',
                    'line-width': 3,
                    'line-opacity': 1.0
                }
            });
        }
    }
}

main().catch(console.error)

