// plotly.js-dist-min ships without types; only the calls Plot.tsx makes are declared.
declare module 'plotly.js-dist-min' {
  const Plotly: {
    react(el: HTMLElement, data: object[], layout: object, config?: object): Promise<HTMLElement>
    purge(el: HTMLElement): void
  }
  export default Plotly
}
