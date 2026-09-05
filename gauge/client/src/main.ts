import * as echarts from 'echarts/core';
import {GaugeChart} from 'echarts/charts';
import {CanvasRenderer} from 'echarts/renderers';
import {Centrifuge, TransportEndpoint} from 'centrifuge';

echarts.use([GaugeChart, CanvasRenderer]);

const serverUrl = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:8080';
const centrifugoBase = import.meta.env.VITE_CENTRIFUGO_BASE_ADDRESS ?? 'localhost:8000';

const names = ['s1', 's2', 's3', 's4', 's5'];
const thresholds = [0.1, 0.2, 0.7, 0.5, 0.9];
const gauges: echarts.ECharts[] = [];

function getChartOption(name: string, threshold: number): echarts.EChartsCoreOption {
    return {
        series: [{
            startAngle: 180,
            endAngle: 0,
            center: ['50%', '90%'],
            radius: 100,
            min: 0,
            max: 30,
            name: 'Serie',
            type: 'gauge',
            splitNumber: 3,
            data: [{value: 16, name}],
            title: {
                show: true,
                offsetCenter: ['-100%', '-90%'],
                textStyle: {color: '#333', fontSize: 15}
            },
            axisLine: {
                lineStyle: {
                    color: [[threshold, '#ff4500'], [1, 'lightgreen']],
                    width: 8
                }
            },
            axisTick: {length: 11, lineStyle: {color: 'auto'}},
            splitLine: {length: 15, lineStyle: {color: 'auto'}},
            detail: {
                show: true,
                offsetCenter: ['100%', '-100%'],
                textStyle: {color: 'auto', fontSize: 25}
            }
        }]
    };
}

function transports(): TransportEndpoint[] {
    return [
        {transport: 'websocket', endpoint: `ws://${centrifugoBase}/connection/websocket`},
        {transport: 'http_stream', endpoint: `http://${centrifugoBase}/connection/http_stream`},
        {transport: 'sse', endpoint: `http://${centrifugoBase}/connection/sse`}
    ];
}

async function main() {
    for (let i = 0; i < names.length; i++) {
        const chart = echarts.init(document.getElementById(`chart${i + 1}`) as HTMLElement);
        chart.setOption(getChartOption(names[i], thresholds[i]));
        gauges.push(chart);
    }

    window.addEventListener('resize', () => gauges.forEach((gauge) => gauge.resize()));

    const response = await fetch(`${serverUrl}/centrifugo-token`);
    if (!response.ok) {
        throw new Error(`Could not fetch token: ${response.status}`);
    }
    const token = await response.text();

    const centrifuge = new Centrifuge(transports(), {token});

    const sub = centrifuge.newSubscription('gauge');
    sub.on('publication', ctx => {
        const data: number[] = ctx.data;
        for (let i = 0; i < 5; i++) {
            gauges[i].setOption({
                series: {data: [{name: names[i], value: data[i]}]}
            });
        }
    });
    sub.subscribe();

    centrifuge.connect();
}

main().catch(console.error);
