import * as echarts from 'echarts/core';
import {PieChart} from 'echarts/charts';
import {TitleComponent, TooltipComponent} from 'echarts/components';
import {CanvasRenderer} from 'echarts/renderers';
import {Centrifuge} from 'centrifuge';
import './main.css';

echarts.use([PieChart, TooltipComponent, TitleComponent, CanvasRenderer]);
const oss = ['Windows', 'macOS', 'Linux', 'Other'];

function getRequiredElement(id) {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing required element: ${id}`);
  }
  return element;
}

function drawChart(data, chart) {
  const pollData = data.split(',').map(Number);
  const total = pollData.reduce((accumulator, currentValue) => accumulator + currentValue, 0);

  chart.setOption({
    title: {
      text: `Total Votes: ${total}`,
      left: 'center'
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
  const response = await fetch(`${import.meta.env.VITE_SERVER_URL}/token`);
  const token = await response.text();

  const votedMessage = getRequiredElement('voted');
  const alreadyVotedMessage = getRequiredElement('hasVotedAlreadyErrorMsg');
  const voteForm = getRequiredElement('vote-form');
  const voteButton = getRequiredElement('vote-button');
  const chartElement = getRequiredElement('chart');
  const alreadyVoted = localStorage.getItem('hasVoted') === 'true';

  alreadyVotedMessage.classList.toggle('hidden', !alreadyVoted);
  voteForm.classList.toggle('hidden', alreadyVoted);

  voteButton.addEventListener('click', () => {
    const choice = document.querySelector('input[name=os]:checked')?.value;
    if (!choice) {
      return;
    }

    localStorage.setItem('hasVoted', 'true');

    fetch(`${import.meta.env.VITE_SERVER_URL}/poll`, {
      method: 'POST',
      body: choice
    }).then(() => {
      votedMessage.classList.remove('hidden');
      alreadyVotedMessage.classList.add('hidden');
      voteForm.classList.add('hidden');
    }).catch((error) => console.error(error));
  });

  const chart = echarts.init(chartElement);
  chart.setOption(getChartOption());
  window.addEventListener('resize', () => chart.resize());

  const pollResponse = await fetch(`${import.meta.env.VITE_SERVER_URL}/poll`);
  const pollData = await pollResponse.text();
  drawChart(pollData, chart);

  const centrifuge = new Centrifuge(transports(), {token});
  centrifuge.on('publication', (ctx) => {
    const data = ctx.data?.result;
    if (typeof data === 'string') {
      drawChart(data, chart);
    }
  });
  centrifuge.connect();
}

function getChartOption() {
  return {
    title: {
      text: 'Votes',
      left: 'center'
    },
    tooltip: {
      trigger: 'item',
      formatter: '{b} : {c} ({d}%)'
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

