import * as echarts from 'echarts/core';
import {PieChart} from 'echarts/charts';
import {TitleComponent, TooltipComponent} from 'echarts/components';
import {CanvasRenderer} from 'echarts/renderers';
import {Centrifuge} from 'centrifuge';
import './main.css';

echarts.use([PieChart, TooltipComponent, TitleComponent, CanvasRenderer]);
const oss = ["Windows", "macOS", "Linux", "Other"];


function drawChart(data, chart) {
  const pollData = data.split(',').map(Number);
  const total = pollData.reduce((accumulator, currentValue) => accumulator + currentValue);

  chart.setOption({
    title: {
      text: `Total Votes: ${total}`
    },
    series: {
      data: [
        {value: pollData[0], name: oss[0]},
        {value: pollData[1], name: oss[1]},
        {value: pollData[2], name: oss[2]},
        {value: pollData[3], name: oss[3]}
      ],
    }
  });
}

function transports() {
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

export async function init() {

  const response = await fetch('http://localhost:8080/token');
  const token = await response.text();

  const alreadyVoted = localStorage.getItem('hasVoted');
  document.getElementById('hasVotedAlreadyErrorMsg').classList.toggle('hidden', !alreadyVoted);
  document.getElementById('vote-form').classList.toggle('hidden', alreadyVoted === 'true');

  const voteButton = document.getElementById('vote-button');

  voteButton.addEventListener('click', () => {
    localStorage.setItem('hasVoted', "true")
    const choice = document.querySelector('input[name=os]:checked').value;

    fetch(`${import.meta.env.VITE_SERVER_URL}/poll`, {
      method: 'POST',
      body: choice
    }).then(() => {
      document.getElementById('voted').classList.remove('hidden');
      document.getElementById('hasVotedAlreadyErrorMsg').classList.add('hidden');
      document.getElementById('vote-form').classList.add('hidden');
    }).catch((e) => console.log(e));
  });

  const chart = echarts.init(document.getElementById('chart'));
  chart.setOption(getChartOption());

  const pollResponse = await fetch(`${import.meta.env.VITE_SERVER_URL}/poll`);
  const pollData = await pollResponse.text();
  drawChart(pollData, chart);

  const centrifuge = new Centrifuge(transports(), {token});
  centrifuge.on('publication', function (ctx) {
    console.log(ctx);
    const data = ctx.data.result;
    drawChart(data, chart);
  });
  centrifuge.connect();
}

function getChartOption() {
  return {
    title: {
      text: 'Votes',
      x: 'center'
    },
    tooltip: {
      trigger: 'item',
      formatter: "{b} : {c} ({d}%)"
    },
    series: [
      {
        name: 'Operating System',
        type: 'pie',
        radius: '60%',
        center: ['50%', '45%'],
        data: [
          {value: 0, name: oss[0]},
          {value: 0, name: oss[1]},
          {value: 0, name: oss[2]},
          {value: 0, name: oss[3]}
        ],
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      }
    ]
  };
}

init();

