"""Preset substrates for the dropdown. Their scores are computed ahead of time.

The descriptions state physical facts about each substrate, not conclusions, so the
rubric does the judging. If you edit one, re-run `scripts/score_presets.py`.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Preset:
    id: str
    name: str
    description: str


PRESETS: tuple[Preset, ...] = (
    Preset(
        id="digital_computer",
        name="Digital computer",
        description=(
            "A conventional silicon computer (CPU and GPU) running a detailed software "
            "simulation of the lost cortical circuits. The simulated neurons and synapses exist "
            "only as numbers in memory: the hardware executes instructions on a global clock, "
            "shuttling data between separate memory and processor chips over buses, and the "
            "same transistors are reused for every simulated neuron in turn. The simulated "
            "network is recurrent and can learn, because the software updates its synaptic "
            "weights. It connects to the brain through an implanted electrode array that "
            "records neural activity and stimulates tissue, with a few milliseconds of "
            "processing delay. The electronics are shielded so electromagnetic fields do not "
            "affect computation. It sits outside the skull or in a sealed implant, needs only "
            "electrical power and cooling, can be upgraded or replaced, and its state can be "
            "backed up."
        ),
    ),
    Preset(
        id="quantum_computer",
        name="Quantum computer",
        description=(
            "A superconducting quantum computer with a few hundred qubits kept near absolute "
            "zero in a dilution refrigerator. Qubits hold quantum superpositions for roughly a "
            "hundred microseconds; the computer is engineered to avoid uncontrolled "
            "decoherence and ends each computation by deliberate measurement. It runs quantum "
            "algorithms as sequences of gate operations controlled by classical electronics, "
            "with heavy error correction. It is far too large and cold to implant, so it would "
            "sit in a facility linked to an implanted electrode array through a classical "
            "computer, adding latency. It needs constant cryogenic cooling and specialist "
            "maintenance, but hardware can be repaired or replaced."
        ),
    ),
    Preset(
        id="neuromorphic_chip",
        name="Neuromorphic chip",
        description=(
            "An implanted silicon chip in which every artificial neuron and synapse is its own "
            "physical circuit. Circuits run in parallel and communicate with spikes; they are "
            "wired with on-chip recurrent and long-range connections, and local learning rules "
            "(spike-timing-dependent plasticity) change synaptic strengths on the chip itself. "
            "It runs on milliwatts in a sealed, biocompatible package and exchanges spikes with "
            "the brain through electrodes that both record and stimulate, with sub-millisecond "
            "latency. Fan-in per neuron is limited by the hardware, the chip's electric fields "
            "are small and shielded, and it has no microtubules or living cells. The package "
            "lasts years; replacing it means surgery, though its learned weights can be read "
            "out and copied."
        ),
    ),
    Preset(
        id="oect_network",
        name="OECT network",
        description=(
            "A network of organic electrochemical transistors made of a soft conducting "
            "polymer (PEDOT:PSS) bathed in the body's own fluid. Ions from the electrolyte move "
            "in and out of each transistor's channel, giving analog, millisecond-scale dynamics "
            "with built-in short- and long-term memory, so the network can learn by changing "
            "conductances. Polymer fibers can be grown between electrodes to form recurrent, "
            "dendrite-like connections, and all devices share the same electrolyte, so they "
            "also interact through ionic currents and electric fields spreading through it. It "
            "interfaces directly with neurons because both work in ionic fluid. It is soft and "
            "fairly biocompatible but needs a sealed electrolyte environment, slowly degrades "
            "over months to years, and is not easily repaired once implanted."
        ),
    ),
    Preset(
        id="ionic_hydrogel",
        name="Ionic hydrogel",
        description=(
            "A soft, water-rich polymer gel that carries ions and computes with them. Ionic "
            "diodes, transistors and memristors are patterned into one continuous gel, and "
            "information is carried by ion flows and charge distributions spreading through it "
            "on millisecond-to-second timescales. The gel's state changes with use, giving "
            "simple memory and adaptation, and electric fields from ion currents extend through "
            "the whole medium and in turn steer ion movement. It is mechanically similar to "
            "brain tissue and placed directly against it, coupling to neurons ionically. It "
            "has far fewer distinct computing elements than a chip, swells and degrades over "
            "months, and would need periodic replacement."
        ),
    ),
    Preset(
        id="engineered_neural_tissue",
        name="Engineered neural tissue",
        description=(
            "A graft of about 90,000 lab-grown human neurons (from stem cells) held in "
            "microwells on a thin implant on the surface of the cortex. The neurons are living "
            "cells with normal neuronal structure, including dendritic microtubules. They form "
            "dense recurrent synaptic networks among themselves, grow axons into the host brain "
            "and receive connections back, so they can join host circuits in both directions, "
            "and their synapses change with activity. Their firing generates local electric "
            "fields like native tissue, and they can be stimulated with light (optogenetics) "
            "and recorded by the implant's electronics. They depend on the host's blood supply "
            "for oxygen and nutrients, may trigger an immune response, can die over time, and "
            "cannot be replaced without new surgery and losing what the graft learned."
        ),
    ),
    Preset(
        id="gel_neuron_hybrid",
        name="Gel–neuron hybrid",
        description=(
            "Lab-grown human neurons embedded in a conductive hydrogel scaffold with built-in "
            "electrodes. The living neurons form recurrent synaptic networks with each other "
            "and with the host brain, keep normal neuronal structure including microtubules, "
            "and change their synapses with activity. The gel guides their growth, matches "
            "brain stiffness, and adds extra electrical coupling: currents and fields spread "
            "through the conductive gel between neurons, and the embedded electronics read and "
            "write activity across the whole volume. The neurons need nutrient and oxygen "
            "supply, partly from host blood vessels growing into the gel and partly from "
            "perfusion channels. The gel and electronics can be partly serviced, but the cells "
            "can die and the immune response must be managed."
        ),
    ),
    Preset(
        id="healthy_cortex",
        name="Healthy cortex (reference)",
        description=(
            "Healthy, living human cerebral cortex: the tissue the implant is meant to "
            "replace, included as a reference point. Billions of neurons with dendritic "
            "microtubules are linked by local and long-range reciprocal connections, including "
            "loops with the thalamus, and work alongside glial cells. Activity shows "
            "oscillations and synchrony that produce measurable electromagnetic fields (EEG), "
            "and those fields can influence neurons through ephaptic coupling. Synapses change "
            "with experience throughout life. It is supplied by blood vessels, regulated by "
            "the body, protected by the blood-brain barrier, and repairs itself only to a "
            "limited extent, but it is natively part of the patient."
        ),
    ),
)

BY_ID = {preset.id: preset for preset in PRESETS}
