import {SmoothieChart, TimeSeries} from 'smoothie';
import {Centrifuge, TransportEndpoint} from 'centrifuge';

const seriesOptions = [
    {strokeStyle: 'rgba(255, 0, 0, 1)', fillStyle: 'rgba(255, 0, 0, 0.1)', lineWidth: 3},
    {strokeStyle: 'rgba(0, 255, 0, 1)', fillStyle: 'rgba(0, 255, 0, 0.1)', lineWidth: 3},
    {strokeStyle: 'rgba(0, 0, 255, 1)', fillStyle: 'rgba(0, 0, 255, 0.1)', lineWidth: 3},
    {strokeStyle: 'rgba(255, 255, 0, 1)', fillStyle: 'rgba(255, 255, 0, 0.1)', lineWidth: 3}
];

type HostId = 'host1' | 'host2' | 'host3' | 'host4';

const cpuDataSets: Record<HostId, TimeSeries[]> = {
    host1: [new TimeSeries(), new TimeSeries(), new TimeSeries(), new TimeSeries()],
    host2: [new TimeSeries(), new TimeSeries(), new TimeSeries(), new TimeSeries()],
    host3: [new TimeSeries(), new TimeSeries(), new TimeSeries(), new TimeSeries()],
    host4: [new TimeSeries(), new TimeSeries(), new TimeSeries(), new TimeSeries()]
};

function initHost(hostId: HostId) {
    const timeline = new SmoothieChart({
        fps: 30,
        millisPerPixel: 20,
        grid: {
            strokeStyle: '#555555',
            lineWidth: 1,
            millisPerLine: 1000,
            verticalSections: 4
        }
    });
    for (let i = 0; i < cpuDataSets[hostId].length; i++) {
        timeline.addTimeSeries(cpuDataSets[hostId][i], seriesOptions[i]);
    }
    timeline.streamTo(document.getElementById(hostId + 'Cpu') as HTMLCanvasElement, 1000);
}

function addDataToDataSets(time: number, serverData: number[], dataSets: TimeSeries[]) {
    for (let i = 0; i < dataSets.length; i++) {
        dataSets[i].append(time, serverData[i]);
    }
}

function transports(): TransportEndpoint[] {
    return [
        {transport: 'websocket', endpoint: `ws://${import.meta.env.VITE_CENTRIFUGO_BASE_ADDRESS}/connection/websocket`},
        {transport: 'http_stream', endpoint: `http://${import.meta.env.VITE_CENTRIFUGO_BASE_ADDRESS}/connection/http_stream`},
        {transport: 'sse', endpoint: `http://${import.meta.env.VITE_CENTRIFUGO_BASE_ADDRESS}/connection/sse`}
    ];
}

async function main() {
    initHost('host1');
    initHost('host2');
    initHost('host3');
    initHost('host4');

    const response = await fetch(`${import.meta.env.VITE_SERVER_URL}/centrifugo-token`);
    const token = await response.text();

    const centrifuge = new Centrifuge(transports(), {token});

    const sub = centrifuge.newSubscription('smoothie');
    sub.on('publication', ctx => {
        const data = ctx.data as {time: number; host1: number[]; host2: number[]; host3: number[]; host4: number[]};
        addDataToDataSets(data.time, data.host1, cpuDataSets.host1);
        addDataToDataSets(data.time, data.host2, cpuDataSets.host2);
        addDataToDataSets(data.time, data.host3, cpuDataSets.host3);
        addDataToDataSets(data.time, data.host4, cpuDataSets.host4);
    });
    sub.subscribe();

    centrifuge.connect();
}

main().catch(console.error);
