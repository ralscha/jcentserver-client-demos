import * as echarts from 'echarts';
import {Centrifuge, TransportEndpoint} from 'centrifuge';

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
        {transport: 'websocket', endpoint: `ws://${import.meta.env.VITE_CENTRIFUGO_BASE_ADDRESS}/connection/websocket`},
        {transport: 'http_stream', endpoint: `http://${import.meta.env.VITE_CENTRIFUGO_BASE_ADDRESS}/connection/http_stream`},
        {transport: 'sse', endpoint: `http://${import.meta.env.VITE_CENTRIFUGO_BASE_ADDRESS}/connection/sse`}
    ];
}

async function main() {
    for (let i = 0; i < names.length; i++) {
        const chart = echarts.init(document.getElementById(`chart${i + 1}`) as HTMLElement);
        chart.setOption(getChartOption(names[i], thresholds[i]));
        gauges.push(chart);
    }

    const response = await fetch(`${import.meta.env.VITE_SERVER_URL}/centrifugo-token`);
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
