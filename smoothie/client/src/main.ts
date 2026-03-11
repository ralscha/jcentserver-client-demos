import * as echarts from 'echarts/core';
import {LineChart} from 'echarts/charts';
import {GridComponent, LegendComponent, TitleComponent, TooltipComponent} from 'echarts/components';
import {CanvasRenderer} from 'echarts/renderers';
import {Centrifuge, TransportEndpoint} from 'centrifuge';

echarts.use([LineChart, GridComponent, LegendComponent, TitleComponent, TooltipComponent, CanvasRenderer]);

type HostId = 'host1' | 'host2' | 'host3' | 'host4';
type MetricPoint = [number, number];

const maxPoints = 90;
const seriesNames = ['CPU 1', 'CPU 2', 'CPU 3', 'CPU 4'];
const hostLabels: Record<HostId, string> = {
    host1: 'host1.example.com',
    host2: 'host2.example.com',
    host3: 'host3.example.com',
    host4: 'host4.example.com'
};

const cpuDataSets: Record<HostId, MetricPoint[][]> = {
    host1: [[], [], [], []],
    host2: [[], [], [], []],
    host3: [[], [], [], []],
    host4: [[], [], [], []]
};

const charts = new Map<HostId, ReturnType<typeof echarts.init>>();

function createHostChart(hostId: HostId) {
    const element = document.getElementById(`${hostId}Cpu`);
    if (!(element instanceof HTMLDivElement)) {
        throw new Error(`Chart container not found for ${hostId}`);
    }

    const chart = echarts.init(element);
    chart.setOption({
        animation: false,
        color: ['#ff6b6b', '#2dd4bf', '#60a5fa', '#facc15'],
        title: {
            text: hostLabels[hostId],
            left: 0,
            top: 0,
            textStyle: {
                color: '#f8fafc',
                fontSize: 16,
                fontWeight: 600
            }
        },
        legend: {
            top: 28,
            left: 0,
            textStyle: {
                color: '#cbd5e1'
            }
        },
        grid: {
            top: 84,
            left: 48,
            right: 18,
            bottom: 36
        },
        tooltip: {
            trigger: 'axis',
            valueFormatter: (value: number | string) => typeof value === 'number' ? `${value.toFixed(1)}%` : `${value}%`
        },
        xAxis: {
            type: 'time',
            boundaryGap: false,
            axisLabel: {
                color: '#94a3b8'
            },
            axisLine: {
                lineStyle: {
                    color: '#334155'
                }
            },
            splitLine: {
                lineStyle: {
                    color: '#1e293b'
                }
            }
        },
        yAxis: {
            type: 'value',
            min: 0,
            max: 100,
            name: 'CPU %',
            nameTextStyle: {
                color: '#94a3b8'
            },
            axisLabel: {
                color: '#94a3b8'
            },
            axisLine: {
                lineStyle: {
                    color: '#334155'
                }
            },
            splitLine: {
                lineStyle: {
                    color: '#1e293b'
                }
            }
        },
        series: cpuDataSets[hostId].map((data, index) => ({
            name: seriesNames[index],
            type: 'line',
            smooth: true,
            showSymbol: false,
            sampling: 'lttb',
            areaStyle: {
                opacity: 0.08
            },
            lineStyle: {
                width: 2
            },
            data
        }))
    });
    charts.set(hostId, chart);
}

function updateHostChart(hostId: HostId) {
    const chart = charts.get(hostId);
    if (!chart) {
        return;
    }

    chart.setOption({
        series: cpuDataSets[hostId].map((data, index) => ({
            name: seriesNames[index],
            data
        }))
    }, {lazyUpdate: true});
}

function toCpuPercent(value: number) {
    return value * 100;
}

function addDataToDataSets(time: number, serverData: number[], dataSets: MetricPoint[][]) {
    for (let i = 0; i < dataSets.length; i++) {
        dataSets[i].push([time, toCpuPercent(serverData[i] ?? 0)]);
        if (dataSets[i].length > maxPoints) {
            dataSets[i].shift();
        }
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
    createHostChart('host1');
    createHostChart('host2');
    createHostChart('host3');
    createHostChart('host4');

    window.addEventListener('resize', () => {
        for (const chart of charts.values()) {
            chart.resize();
        }
    });

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
        updateHostChart('host1');
        updateHostChart('host2');
        updateHostChart('host3');
        updateHostChart('host4');
    });
    sub.subscribe();

    centrifuge.connect();
}

main().catch(console.error);
