import satIconUrl from './saticon.gif'
import {Centrifuge, TransportEndpoint} from 'centrifuge';
import * as maptilersdk from '@maptiler/sdk';
import '@maptiler/sdk/dist/maptiler-sdk.css';

const serverUrl = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:8080';
const centrifugoBase = import.meta.env.VITE_CENTRIFUGO_BASE_ADDRESS ?? 'localhost:8000';

maptilersdk.config.apiKey = import.meta.env.VITE_MAPTILER_API_KEY;

let centered = false;
let issMarker: maptilersdk.Marker | null = null;
const flightPath: [number, number][] = [];

interface TokenResponse {
    userId: string;
    token: string;
}

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

    const tokenResponse = await fetchCentrifugoToken();

    const centrifuge = new Centrifuge(transports(), {token: tokenResponse.token});

    // Publications from server-side subscriptions arrive on the client itself.
    centrifuge.on('publication', ctx => updateMarker(map, ctx.data));

    const connected = new Promise<void>((resolve) => {
        centrifuge.once('connected', () => resolve());
    });
    centrifuge.connect();
    await connected;
    await subscribe(tokenResponse.userId);

}

function transports(): TransportEndpoint[] {
    return [
        {
            transport: 'websocket',
            endpoint: `ws://${centrifugoBase}/connection/websocket`
        },
        {
            transport: 'http_stream',
            endpoint: `http://${centrifugoBase}/connection/http_stream`
        },
        {
            transport: 'sse',
            endpoint: `http://${centrifugoBase}/connection/sse`
        }
    ];
}

async function fetchCentrifugoToken(): Promise<TokenResponse> {
    const response = await fetch(`${serverUrl}/centrifugo-token`);
    if (!response.ok) {
        throw new Error(`Failed to fetch centrifugo token: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<TokenResponse>;
}

async function subscribe(userId: string): Promise<void> {
    const response = await fetch(`${serverUrl}/subscribe`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({userId})
    });
    if (!response.ok) {
        throw new Error(`Failed to subscribe: ${response.status} ${response.statusText}`);
    }
}

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
