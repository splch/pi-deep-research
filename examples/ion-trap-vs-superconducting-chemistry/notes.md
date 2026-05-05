# Notes — ion-trap vs superconducting qubits for NISQ-era chemistry

## Sub-question 1: Hardware metrics — gate fidelities, gate times, coherence, connectivity

### [Quantinuum extends its significant lead in quantum computing, achieving historic milestones for hardware fidelity and Quantum Volume](https://www.quantinuum.com/blog/quantinuum-extends-its-significant-lead-in-quantum-computing-achieving-historic-milestones-for-hardware-fidelity-and-quantum-volume)
- **Claim**: Quantinuum's H1-1 trapped-ion system reached 99.914(3)% two-qubit gate fidelity across all qubit pairs in production in April 2024.
- **Quote**: > "Quantinuum has become the first company ever to achieve 'three nines' in a commercially-available quantum computer, with the first demonstration of 99.914(3)% 2-qubit gate fidelity, showing repeatable performance across all qubit pairs on our H1-1 system that is constantly available to customers."
- **Quality**: high (vendor blog with named authors, named device, numeric fidelity with error bar, quoted in HPCwire trade press)
- **Date**: 2024-04-16

### [Quantinuum Launches Industry-First, Trapped-Ion 56-Qubit Quantum Computer](https://www.quantinuum.com/press-releases/quantinuum-launches-industry-first-trapped-ion-56-qubit-quantum-computer-that-challenges-the-worlds-best-supercomputers)
- **Claim**: Quantinuum H2-1 operates with 56 qubits with arbitrary all-to-all connectivity at 99.843(5)% two-qubit gate fidelity (June 2024).
- **Quote**: > "we describe recent hardware upgrades to Quantinuum's H2 quantum computer enabling it to operate on up to 56 qubits with arbitrary connectivity and 99.843(5)% two-qubit gate fidelity. Utilizing the flexible connectivity of H2, they present data from random circuit sampling in highly connected geometries"
- **Quality**: high (vendor press release citing the company's PRX paper Moses 2023 / arXiv 2406.02501 DeCross 2024)
- **Date**: 2024-06-05

### [IonQ Achieves Landmark Result, Setting New World Record in Quantum Computing Performance](https://www.ionq.com/news/ionq-achieves-landmark-result-setting-new-world-record-in-quantum-computing)
- **Claim**: In Oct 2025 IonQ (via Oxford Ionics tech) reported a two-qubit gate fidelity exceeding 99.99% — the first "four-nines" demonstration in any modality. Previous record was 99.97% (Oxford Ionics 2024).
- **Quote**: > "IonQ has achieved the world's highest two-qubit gate performance, with fidelity exceeding 99.99% – the first and only quantum computing company to cross the 'four-nines' benchmark. The demonstration released today, achieved using IonQ's proprietary Electronic Qubit Control technology (EQC), surpasses the previous world record of 99.97% set in 2024 by Oxford Ionics, now part of IonQ."
- **Quality**: high (vendor press release, dated, specific number)
- **Date**: 2025-10-21

### [Benchmarking a trapped-ion quantum computer with 30 qubits](https://quantum-journal.org/papers/q-2024-11-07-1516/)
- **Claim**: IonQ Forte was benchmarked at 30 qubits with all-to-all connectivity via direct randomized benchmarking on all 435 qubit pairs and passed application-oriented Algorithmic Qubit benchmarks up to AQ 29.
- **Quote**: > "we demonstrate and thoroughly benchmark the IonQ Forte system: configured as a single-chain 30-qubit trapped-ion quantum computer with all-to-all operations. We assess the performance of our quantum computer operation at the component level via direct randomized benchmarking (DRB) across all 30 choose 2 = 435 gate pairs … the system passes the suite of algorithmic qubit (AQ) benchmarks up to #AQ 29."
- **Quality**: high (peer-reviewed in Quantum Journal, named device, full DRB protocol)
- **Date**: 2024-11-07

### [IonQ Investor Updates Q2 2024 (PDF)](https://s28.q4cdn.com/828571518/files/doc_financials/2024/q2/24-08-07-Investor-Updates-Q2-2024_vF.pdf)
- **Claim**: IonQ Forte 2024 native two-qubit gate fidelity 99.6%, two-qubit gate speed 600 µs (with target 300 µs by 2025).
- **Quote**: > "Native Gate Fidelity 99.3% 99.6% 99.9% >99.9% >99.95% 2QG Speed 600 µs 600 µs 600 µs 300 µs <300 µs … IonQ targeting a 50% reduction in gate speed from 600 µs to 300 µs in 2025"
- **Quality**: medium (investor deck, but contains explicit numeric milestones)
- **Date**: 2024-08-07

### [Processor types | IBM Quantum Documentation](https://quantum.cloud.ibm.com/docs/en/guides/processor-types)
- **Claim**: IBM Heron is a fixed-frequency 156-qubit superconducting processor with tunable couplers and heavy-hexagonal lattice connectivity (each qubit talks to at most 3 neighbors). Heron r2 (July 2024) added TLS mitigation; Heron r3 (July 2025) further improved coherence/fidelity.
- **Quote**: > "At 156 qubits, Heron is an Eagle-sized upgrade to Egret that pulls in substantial innovations in signal delivery … r2 (July 2024) … redesigned to include 156 qubits in a heavy-hexagonal lattice. While continuing to make use of the innovations of the original Heron processors, it also introduces a new TLS mitigation feature"
- **Quality**: high (official IBM documentation)
- **Date**: 2025 (page reflects r3 from July 2025)

### [IBM Unveils 156-Qubit 'Heron R2' Quantum Processor](https://postquantum.com/industry-news/ibm-heron-r2-quantum/)
- **Claim**: Heron-class device median two-qubit gate error improved from ~5×10⁻³ to ~3×10⁻³ in 2024 (i.e. fidelity ~99.7%).
- **Quote**: > "updated calibrations earlier in 2024 improved the median two-qubit gate error rate on a Heron-class device from about 5×10⁻³ to 3×10⁻³ (i.e. from 0.5% down to 0.3%), a substantial boost in fidelity."
- **Quality**: medium (industry news summarizing IBM announcement)
- **Date**: 2024-11

### [IBM Launches Its Most Advanced Quantum Computers](https://newsroom.ibm.com/2024-11-13-ibm-launches-its-most-advanced-quantum-computers,-fueling-new-scientific-value-and-progress-towards-quantum-advantage)
- **Claim**: IBM Heron can run circuits with up to 5,000 two-qubit gates accurately on certain mirrored kicked-Ising workloads — about double the 2,880-gate utility-scale demonstration of 2023; same workload that took 112 hours in 2023 ran in 2.2 hours on Heron (50× speedup).
- **Quote**: > "IBM Quantum Heron, the company's most performant quantum processor to-date and available in IBM's global quantum data centers, can now leverage Qiskit to accurately run certain classes of quantum circuits with up to 5,000 two-qubit gate operations … The same experiment, using the same data points, was run on the latest IBM Heron processor and can be completed in 2.2 hours, which is 50 times faster."
- **Quality**: high (official IBM press release)
- **Date**: 2024-11-13

### [Superconducting quantum computers: who is leading the future?](https://link.springer.com/article/10.1140/epjqt/s40507-025-00405-7)
- **Claim**: Recent IBM Eagle (127-qubit) device ibm_kyiv reported median T1=288 µs and T2=127 µs.
- **Quote**: > "the IBM Eagle processor, ibm\\_kyiv, which consists of 127 fixed-frequency transmon qubits featuring heavy-hex connectivity. While ibm\\_ithaca was utilized to develop calibration and data-processing strategies … The median T1 and T2 times are 288 μs and 127 μs, respectively—unprecedented coherence times for superconducting processors of this scale"
- **Quality**: high (peer-reviewed EPJ Quantum Technology)
- **Date**: 2025

### [Researchers at the SQMS Center achieve leading performance in transmon qubits](https://news.fnal.gov/2024/05/researchers-at-the-sqms-center-achieve-leading-performance-in-transmon-qubits/)
- **Claim**: 2024 best lab transmons reached average T1 ≈ 0.3 ms, max ≈ 0.6 ms (Fermilab/SQMS, Bal et al., npj QI 10, 43 (2024)).
- **Quote**: > "Scientists and engineers at the Superconducting Quantum Materials and Systems Center, hosted by the U.S. Department of Energy's Fermi National Accelerator Laboratory, have achieved reproducible improvements in superconducting transmon qubit lifetimes with record values of 0.6 milliseconds … tantalum and gold proved to be the most effective for enabling a higher coherence time, with an average of 0.3 milliseconds and maximum values as high as 0.6 milliseconds."
- **Quality**: high (DOE national lab press, links to Bal et al. npj QI 10, 43)
- **Date**: 2024-05-15

### [Methods to achieve near-millisecond energy relaxation and dephasing times for a superconducting transmon qubit](https://www.nature.com/articles/s41467-025-61126-0)
- **Claim**: A 2025 Aalto/VTT result reported a transmon at 2.9 GHz with median T1 = 425 µs (max 666 µs) and median T2-echo = 541 µs (max 1057 µs) — first transmon to exceed 1 ms T2-echo.
- **Quote**: > "We measure a qubit frequency of 2.9 GHz, an energy relaxation time T1 with a median of 425 μs and a maximum of (666 ± 33) μs, and an echo dephasing time T2^echo with a median of 541 μs and a maximum of (1057 ± 138) μs."
- **Quality**: high (peer-reviewed Nature Communications)
- **Date**: 2025

### [Superconducting vs Trapped-Ion Qubits | Comparison (2026)](https://entangledfuture.com/compare/superconducting-vs-trapped-ion/)
- **Claim**: Side-by-side rough numbers: superconducting gates ~10–50 ns, trapped-ion gates ~100–200 µs; superconducting coherence ~100 µs, trapped-ion "minutes to hours"; superconducting nearest-neighbor, trapped-ion all-to-all.
- **Quote**: > "Gate Speed | ~10-50 nanoseconds | ~100-200 microseconds … Coherence Time | ~100 microseconds | Minutes to hours … Connectivity | Nearest-neighbor (fixed) | All-to-all"
- **Quality**: medium (analyst compare site, but matches primary sources)
- **Date**: 2026-03

---

## Sub-question 2: Largest molecule simulated end-to-end on each platform

### [Hartree-Fock on a superconducting qubit quantum computer](https://arxiv.org/abs/2004.04174) (Arute et al., Science 369, 1084 (2020))
- **Claim**: Google ran VQE on the Sycamore processor for hydrogen chains H6, H8, H10, H12 and the diazene (N2H2) cis–trans isomerization, using up to 12 superconducting qubits — at the time, the largest chemistry calculation on any quantum computer.
- **Quote**: > "we perform a series of quantum simulations of chemistry which involve twice the number of qubits and more than ten times the number of gates as the largest prior experiments. We model the binding energy of H6, H8, H10 and H12 chains as well as the isomerization of diazene. We also demonstrate error-mitigation strategies based on N-representability which dramatically improve the effective fidelity of our experiments."
- **Quality**: high (Science journal, Google AI Quantum)
- **Date**: 2020

### [Hardware-efficient Variational Quantum Eigensolver for Small Molecules and Quantum Magnets](https://arxiv.org/abs/1704.05018) (Kandala et al., Nature 549, 242 (2017))
- **Claim**: Original IBM superconducting hardware-efficient VQE: H2, LiH and BeH2 ground-state energies on up to 6 qubits with >100 Pauli terms — first VQE beyond H/He on real hardware.
- **Quote**: > "we demonstrate the experimental optimization of Hamiltonian problems with up to six qubits and more than one hundred Pauli terms, determining the ground-state energy for molecules of increasing size, up to BeH2."
- **Quality**: high (Nature paper)
- **Date**: 2017

### [Ground-state energy estimation of the water molecule on a trapped-ion quantum computer](https://www.nature.com/articles/s41534-020-0259-3) (Nam et al., npj QI 6, 33 (2020))
- **Claim**: IonQ trapped-ion device computed H2O ground-state energy via VQE with errors approaching the chemical-accuracy bound (1.6 mHa) without using ZNE-style error mitigation.
- **Quote**: > "We achieve computational errors approaching 1.6 mHa (equivalent to the bound of chemical accuracy), without using any error mitigation techniques. These results establish a path for future computations on more complex systems as trapped-ion QCs continue to improve"
- **Quality**: high (npj Quantum Information, IonQ + collaborators)
- **Date**: 2020

### [Chemistry Beyond Exact Solutions on a Quantum-Centric Supercomputer](https://arxiv.org/html/2405.05068v1) (Robledo-Moreno et al., 2024)
- **Claim**: IBM/RIKEN sample-based quantum diagonalization (SQD) used up to 77 qubits of a 133-qubit Heron device for the [4Fe-4S] iron-sulfur cluster, with circuits containing ≈3,500 two-qubit gates and a Heron subset showing 99.77% median 2Q fidelity, T1=180 µs, T2=150 µs. Also ran 58 qubits for N2 (cc-pVDZ) and 45 qubits for [2Fe-2S].
- **Quote**: > "The largest experiment is run on a subset of 77 qubits of a 133-qubit Heron quantum processor. The median fidelites for this subset are 99.77% for two-qubits gates, 99.97% for single-qubit, and readout fidelity of 98.37%, with median coherence times T1=180 μs and T2=150 μs … The LUCJ circuit employed for this molecular species contains approximately 3.5k two-qubit gates."
- **Quality**: high (arXiv 2405.05068, IBM-RIKEN-Fugaku collaboration)
- **Date**: 2024

### [The era of quantum utility with IBM Quantum (CERN talk slides)](https://indico.cern.ch/event/1338689/contributions/6080333/attachments/2952086/5189637/2024-10-22-CHEP_IBM_VoicaRadescu.pdf)
- **Claim**: Three SQD chemistry experiments on Heron: 58 qubits for N2 dissociation in cc-pVDZ, 45 qubits for [2Fe-2S] cluster (TZP-DKH), 77 qubits for [4Fe-4S] cluster (TZP-DKH).
- **Quote**: > "(a) 58 qubits are used to model the N2 dissociation (cc-pVDZ basis set). (b) 45 qubits are used for the [2Fe-2S] cluster (TZP-DKH basis set) and (c) 77 qubits for the [4Fe-4S] cluster (TZP-DKH basis set)."
- **Quality**: medium-high (IBM presentation at CHEP, summarises Robledo-Moreno paper)
- **Date**: 2024-10-22

### [Quantum Chemistry Gets Error-Corrected Boost from Quantinuum's Trapped-Ion Computer](https://thequantuminsider.com/2025/05/22/quantum-chemistry-gets-error-corrected-boost-from-quantinuums-trapped-ion-computer/)
- **Claim**: Quantinuum 2025 demonstrated error-corrected quantum phase estimation for the H2 ground state, using up to 22 physical qubits, >2,000 two-qubit gates and hundreds of intermediate measurements; energy converged within 0.018 hartree of exact (above the 0.0016 Ha chemical-accuracy threshold but a real fault-tolerant chemistry result on hardware).
- **Quote**: > "The circuits involved up to 22 qubits, more than 2,000 two-qubit gates and hundreds of intermediate measurements. Despite this complexity, the experiment produced an energy estimate that came within 0.018 hartree of the known exact value for molecular hydrogen … In this study, the Quantinuum team used a seven-qubit color code to protect each logical qubit and inserted additional QEC routines mid-circuit to catch and correct errors as they occurred."
- **Quality**: medium-high (specialist trade outlet summarizing the Quantinuum paper)
- **Date**: 2025-05-22

### [Microsoft and Quantinuum create 12 logical qubits and demonstrate a hybrid, end-to-end chemistry simulation](https://azure.microsoft.com/en-us/blog/quantum/2024/09/10/microsoft-and-quantinuum-create-12-logical-qubits-and-demonstrate-a-hybrid-end-to-end-chemistry-simulation/)
- **Claim**: Microsoft + Quantinuum used Quantinuum H1 ion-trap device to host 2 logical qubits (out of 12 created via qubit virtualization) running an end-to-end chemistry workflow on a catalytic intermediate, with logical-qubit results more accurate than equivalent physical-qubit results.
- **Quote**: > "two logical qubits—created with Microsoft's qubit-virtualization system and Quantinuum's H1 machine—were used to prepare the ground state of the active space of an important catalytic intermediate (Figure 1) and then measured … These logical qubits produced a better estimate of the ground state energy than the comparable computation with the underlying physical qubits, demonstrating the higher reliability of these logical qubits."
- **Quality**: high (Microsoft + Quantinuum joint blog with named authors and named device)
- **Date**: 2024-09-10

---

## Sub-question 3 & 4: Circuit-depth budget for chemistry, ansatz/connectivity overhead

### [Orbital-optimized pair-correlated electron simulations on trapped-ion quantum computers](https://www.nature.com/articles/s41534-023-00730-8) (IonQ + collaborators)
- **Claim**: IonQ used the unitary pair coupled cluster doubles (uPCCD) ansatz on Harmony and Aria to dissociate LiH in STO-3G; encoding pairs to qubits gave a 3-qubit / 4-CX-gate circuit for LiH that is shallow enough for noisy hardware. Long-range entanglement is exploited because trapped ions support all-to-all gates.
- **Quote**: > "We freeze the Li 1s orbital, and also exclude the molecular orbitals formed with Li's 2px and 2py orbitals … By doing so we only need 3 qubits and the VQE circuits consists of only 4 CX gates."
- **Quality**: high (npj Quantum Information, IonQ)
- **Date**: 2023

### [IonQ blog: Orbital-optimized pair-correlated electron simulations](https://www.ionq.com/blog/orbital-optimized-pair-correlated-electron-simulations-on-trapped-ion)
- **Claim**: The all-to-all connectivity of trapped ions allows arbitrary qubit pair entanglement without SWAP overhead, contrasting with superconducting platforms that pay extra gates for the same effect.
- **Quote**: > "we did not limit entanglement to the 'nearest neighbor' of any given qubit. These long-range entanglements can be done very efficiently on trapped-ion systems. This contrasts with superconducting systems, which would need to use more gates to accomplish the same effect."
- **Quality**: medium (vendor blog, but consistent with the npj QI paper above)
- **Date**: 2023

### [Experimental comparison of two quantum computing architectures](https://pmc.ncbi.nlm.nih.gov/articles/PMC5380037/) (Linke et al., PNAS 2017)
- **Claim**: Direct head-to-head benchmark of 5-qubit IBM superconducting vs 5-qubit fully connected trapped-ion. Performance "mirrored the connectivity," with ion trap outperforming superconducting on all algorithms — especially those that require non-nearest-neighbor entanglement. SWAP overhead for star-shaped/linear nearest-neighbor connectivity scales as O(N²) gates relative to fully-connected.
- **Quote**: > "For a general circuit, reducing a fully connected system to the more sparse star-shaped or linear nearest-neighbor connectivity requires an increase in the number of gates of [O(N²)] … The fidelity of the fully connected ion-trap implementation is [higher than] the superconducting device."
- **Quality**: high (PNAS, Maryland/Duke ion trap group)
- **Date**: 2017

### [Lincoln Laboratory technical report on chemistry compilation](https://apps.dtic.mil/sti/pdfs/AD1159426.pdf)
- **Claim**: For chemistry-relevant ADAPT-VQE workloads, segmented (e.g. QCCD) ion-trap architectures pay a runtime cost from split/move/join shuttling operations relative to a single-trap design — i.e. all-to-all connectivity isn't free in seconds even when it is in gate count.
- **Quote**: > "the extra overhead required to split, move, and join ions in these segmented architectures has a significant impact on the total runtime."
- **Quality**: medium-high (DTIC / MIT Lincoln Laboratory technical report)
- **Date**: 2021

### [Setting the Benchmark: Independent Study Ranks Quantinuum #1 in Performance](https://www.quantinuum.com/blog/setting-the-benchmark-independent-study-ranks-quantinuum-1-in-performance)
- **Claim**: A 2025 independent benchmarking paper (Montañez-Barrera et al., arXiv 2502) on QPU performance at large width and depth ranked Quantinuum H2 ahead of competitors on circuit-depth-versus-fidelity metrics.
- **Quote**: > "16 Montanez-Barrera, J. A., et al. 'Evaluating the Performance of Quantum Process Units at Large Width and Depth.' arXiv, 10 Feb. 2025"
- **Quality**: medium (vendor citation of an arXiv paper; the underlying paper is independent)
- **Date**: 2025

---

## Sub-question 5: Wall-clock throughput / shot cost

### [IonQ Investor Updates Q2 2024 (PDF)](https://s28.q4cdn.com/828571518/files/doc_financials/2024/q2/24-08-07-Investor-Updates-Q2-2024_vF.pdf)
- **Claim**: IonQ Forte two-qubit gate time is 600 µs (2024); only 1–2% of wall-clock time is spent computing in current chain-shuttling architectures (most is shuttling overhead).
- **Quote**: > "2QG Speed 600 µs … On average only 1-2% of wall clock time spent computing"
- **Quality**: medium (investor deck)
- **Date**: 2024

### [IBM Heron vs trapped-ion gate-time numbers](https://entangledfuture.com/compare/superconducting-vs-trapped-ion/)
- **Claim**: Superconducting gate times ~10–50 ns are roughly 4 orders of magnitude faster than trapped-ion ~100–200 µs gates. This compounds over a million-shot VQE.
- **Quote**: > "Gate Speed | ~10-50 nanoseconds | ~100-200 microseconds"
- **Quality**: medium (analyst comparison)
- **Date**: 2026

### [IonQ blog: Beyond Qubit Counts](https://www.ionq.com/blog/beyond-qubit-counts-introducing-ionqs-application-centric-benchmarking-framework)
- **Claim**: IonQ's own benchmarking framework treats VQE as a stress test rather than production application; explicitly notes "architectures with faster gate speeds hold a TTS [time-to-solution] advantage" on VQE-like workloads.
- **Quote**: > "On variational algorithms of this class, architectures with faster gate speeds hold a TTS advantage, a tradeoff this framework reports directly rather than omits."
- **Quality**: medium-high (vendor self-disclosure of a competitive disadvantage)
- **Date**: 2025

### [Chemistry Beyond Exact Solutions on a Quantum-Centric Supercomputer](https://arxiv.org/html/2405.05068v1)
- **Claim**: The largest IBM/RIKEN [4Fe-4S] experiment ran circuits up to 3 million times each, with QPU runtime ~45 min per experiment.
- **Quote**: > "The quantum circuits are executed a maximum of three million times with a ∼45 minute QPU runtime per experiment."
- **Quality**: high (peer-reviewed-style preprint with named figure)
- **Date**: 2024

---

## Sub-question 6: Error-mitigation overhead and methods on each platform

### [Hardware-Efficient VQE BeH2 (Kandala 2017, IBM blog)](https://www.ibm.com/quantum/blog/quantum-molecule)
- **Claim**: Original IBM hardware-efficient VQE used Richardson extrapolation (zero-noise-extrapolation) as the post-processing error mitigation technique to recover BeH2 ground state energies on a 6-qubit superconducting device.
- **Quote**: > "Introduced a hardware-efficient VQE ansatz tailored to superconducting qubit native gate sets and connectivity, enabling ground-state energy estimation for molecules up to BeH2 on real quantum hardware. Richardson extrapolation was introduced as a practical post-processing error mitigation technique without requiring quantum error correction." (CIFR research-agent summary of Kandala et al. 2017)
- **Quality**: medium (paraphrase site, but the primary Kandala 2017 Nature paper is consistent)
- **Date**: 2017

### [Synergetic quantum error mitigation by randomized compiling and zero-noise extrapolation for the variational quantum eigensolver](https://quantum-journal.org/papers/q-2023-11-20-1184/) (Quantum 2023)
- **Claim**: For VQE on small molecules, combining randomized compiling with ZNE can mitigate energy errors from coherent noise by up to two orders of magnitude.
- **Quote**: > "of VQE for small molecules shows that the proposed strategy can mitigate energy errors induced by various types of coherent noise by up to two orders of magnitude."
- **Quality**: high (peer-reviewed in Quantum Journal)
- **Date**: 2023

### [Pushing the boundaries of NISQ with error mitigation](https://communities.springernature.com/posts/pushing-the-boundaries-of-nisq-with-error-mitigation) (Nature Physics)
- **Claim**: Purification-based error-mitigation methods can reduce chemistry-relevant errors up to 100×, with scalability that improves rather than degrades on larger circuits.
- **Quote**: > "We found the purification based error mitigation techniques to be very effective under the real noise of the device. A decrease in error of up to a hundredfold could be achieved. Even better, this error suppression appears able to cope with or perform better at larger computations."
- **Quality**: high (Nature Physics blog summarizing the paper)
- **Date**: 2022

### [Crossing the quantum chasm: From NISQ to fault tolerance](https://quantumfrontiers.com/2023/12/09/crossing-the-quantum-chasm-from-nisq-to-fault-tolerance/) (Caltech / Quantum Frontiers, John Preskill)
- **Claim**: ZNE/PEC are useful but their asymptotic cost scales exponentially with circuit size, so error mitigation alone may not suffice for chemistry quantum advantage.
- **Quote**: > "we use error mitigation methods like zero noise extrapolation or probabilistic error cancellation. These methods work effectively at extending the size of the circuits we can execute with useful fidelity. But the asymptotic cost scales exponentially with the size of the circuit, so error mitigation alone may not suffice to reach quantum value."
- **Quality**: high (Preskill / Caltech Quantum Frontiers blog)
- **Date**: 2023-12

### [Automated Quantum Algorithm Discovery for Quantum Chemistry (Quantinuum blog)](https://www.quantinuum.com/blog/automated-quantum-algorithm-discovery-for-quantum-chemistry)
- **Claim**: Quantinuum's H2 emulator carries 1.05×10⁻³ two-qubit gate error; chemistry circuits routinely use Partition Measurement Symmetry Verification (PMSV) error mitigation; LiH at r=1.5 Å run on H2 hardware with PMSV produced energy −7.8767 ± [bound].
- **Quote**: > "we employed Quantinuum's H2 Emulator, which provides a faithful classical simulator of the H2 quantum computer, characterised by a 1.05e-3 two-qubit gate error rate … We subsequently executed the specific circuit generated by this algorithm for the LiH molecule at a bond length of 1.5 Å with the Partition Measurement Symmetry Verification (PMSV) error mitigation procedure. The resulting energy of -7.8767 ±"
- **Quality**: medium-high (Quantinuum blog, named device, named technique)
- **Date**: 2025

---

## Sub-question 7: Consensus & near-term direction

### [QIR (MIT) Quantum Processor Benchmarking Insights](https://qir.mit.edu/benchmarking/)
- **Claim**: Across modalities, trapped-ion 2Q fidelities have led the field, growing exponentially; superconducting top fidelity dipped 2018–2022 but recovered with IBM Heron r2 in 2023–2024. Trapped ions hold the fidelity record; superconducting holds the qubit-count record at single-chip scale.
- **Quote**: > "Trapped Ions have shown consistent growth and demonstrated the highest overall fidelity. Superconducting QPUs experienced a decline in top fidelity from 2018 to 2022 until peak fidelity was achieved by the Alibaba QPU. … IBM and Google caught up to similar fidelity rates in 2023 and 2024 … the Trapped Ion devices from Quantinuum and Oxford Ionics … reached a 0.999 ('triple-nine') fidelity, an important rubicon. However, this was achieved with relatively smaller qubit sizes. Amongst Superconducting QPUs, Google and IBM are class leaders, with the IBM's Heron r2 achieving the highest performance across this benchmark."
- **Quality**: high (MIT-hosted benchmarking aggregation)
- **Date**: 2025

### [IonQ blog: Beyond Qubit Counts (application-centric benchmarking)](https://www.ionq.com/blog/beyond-qubit-counts-introducing-ionqs-application-centric-benchmarking-framework)
- **Claim**: As of 2025, no quantum computing platform has hit the "solved" criterion (energy within 1 mHa of exact) on the IonQ-defined VQE chemistry benchmark across hydrogen chains H2 to H18.
- **Quote**: > "The 'solved' criterion is energy accuracy within 1 mHa of the exact solution. This standard currently remains unmet across the quantum computing industry."
- **Quality**: medium-high (vendor admission against own benchmark)
- **Date**: 2025

### [IBM Quantum System Two: era of quantum utility](https://www.ibm.com/quantum/blog/quantum-roadmap-2033)
- **Claim**: IBM's strategy is to scale through Heron-class processors and quantum-centric supercomputing (parallel quantum + classical), e.g. SQD on Fugaku for chemistry. IBM Heron offers 3–5× device performance over Eagle.
- **Quote**: > "Heron yields a 3-5x improvement in device performance over our previous flagship 127-qubit Eagle processors, and virtually eliminates cross-talk."
- **Quality**: high (IBM Quantum corporate blog)
- **Date**: 2024

### [Roadmap - IonQ](https://www.ionq.com/roadmap)
- **Claim**: IonQ's near-term roadmap targets 64–100+ physical qubits in 2025, microwave-gate operations, 2D arrays, mid-circuit measurement, parallel operations.
- **Quote**: > "2025 ### 64-100+ physical qubits 99.9% Physical qubit fidelity All-to-all connectivity Microwave gate operations 2D qubit array Mid-circuit measurement Parallel operations"
- **Quality**: medium (vendor roadmap; aspirational but documents intent)
- **Date**: 2025-2026

### [Benchmarking Quantum Computers via Protocols Comparing Superconducting and Ion-Trap Quantum Technology](https://arxiv.org/html/2603.27397v2) (arXiv preprint)
- **Claim**: Recent direct comparison study contrasted AQT IBEX Q1 (12-qubit ion-trap, all-to-all via shared phonon mode) with IBM Fez (156-qubit Heron r2) and IBM Brisbane (127-qubit Eagle r3); confirms the platforms differ along the connectivity-vs-scale axis.
- **Quote**: > "the all-to-all connectivity of IBEX Q1, mediated by a collective phonon mode, implies that a quantum operation can be executed between any arbitrary pair of qubits without intermediate routing. The comparative analysis includes two superconducting systems from IBM: Fez, a 156-qubit processor from the Heron-r2 series and Brisbane, a 127-qubit processor from the Eagle-r3 series. Both superconducting devices feature qubits arranged in a fixed rectangular lattice."
- **Quality**: medium-high (independent academic preprint)
- **Date**: 2025-2026
