/// <reference types="vite/client" />

declare module 'smoothie' {
    export class SmoothieChart {
        constructor(options?: object);
        addTimeSeries(series: TimeSeries, options?: object): void;
        streamTo(canvas: HTMLCanvasElement, delay?: number): void;
    }
    export class TimeSeries {
        append(timestamp: number, value: number): void;
    }
}
