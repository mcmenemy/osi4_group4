import type { Tab } from './OverviewView'

export interface DemoStep {
  tab: Tab
  /** id of the element to scroll to and highlight */
  target: string
  text: string
  /** Score tab only: which preset to show, which framework to open, or the custom form. */
  preset?: string
  openFramework?: string
  customMode?: boolean
}

export const DEMO_STEPS: DemoStep[] = [
  {
    tab: 'overview',
    target: 'findings',
    text:
      "The question: if a patient keeps losing cortex, what could an implant be made of to take over part of its work? These are the headline results; Next walks through how we got them.",
  },
  {
    tab: 'score',
    target: 'score-result',
    preset: 'gel_neuron_hybrid',
    text:
      'Each candidate is described in plain physical terms. Claude judges it against 25 criteria from six theories of mind, three separate times. Here: the gel–neuron hybrid.',
  },
  {
    tab: 'score',
    target: 'fw-iit',
    preset: 'gel_neuron_hybrid',
    openFramework: 'iit',
    text:
      "Every score shows its working: a verdict and a reason for each criterion. Our code, not Claude, turns verdicts into the 0–3 score, so a score can't contradict its reasoning.",
  },
  {
    tab: 'score',
    target: 'compare',
    text:
      'All eight candidates side by side. The living implants get the most theory support but are among the hardest to keep running.',
  },
  {
    tab: 'sim',
    target: 'sim-function',
    text:
      'Now a spiking-network simulation: the host cortex has to remember a brief input while we kill off its neurons. Compare how much memory each implant keeps.',
  },
  {
    tab: 'sim',
    target: 'sim-phi',
    text:
      'Integrated information theory, computed with PyPhi on a rolled-up model: as the host degrades, watch how often the most integrated part of the system includes the implant.',
  },
  {
    tab: 'sim',
    target: 'sim-sweep',
    text:
      'Is the result robust? We vary feedback strength and implant speed across 9 settings, each averaged over several random seeds.',
  },
  {
    tab: 'microwell',
    target: 'microwell-maps',
    text:
      "Linking to our team's experiment: if gel-filled microwells improved graft survival or outgrowth, how much function would that buy?",
  },
  {
    tab: 'score',
    target: 'custom-form',
    customMode: true,
    text: 'Your turn: describe any substrate and Claude scores it live in about half a minute.',
  },
]
