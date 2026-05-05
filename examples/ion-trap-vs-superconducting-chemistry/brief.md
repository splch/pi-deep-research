# Research brief: ion-trap vs superconducting qubits for NISQ-era chemistry

**Goal**: Compare trapped-ion and superconducting transmon qubit platforms as practical engines for noisy intermediate-scale quantum (NISQ) chemistry workloads — primarily variational ground-state energy estimation (VQE-family) and related near-term molecular simulation algorithms.
**Audience**: Technically literate researcher / engineer (graduate-level QC literacy) deciding which platform to use, build on, or read more about for chemistry-flavored NISQ work.
**Scope**: Hardware metrics (qubit count, native gate fidelities, gate times, connectivity, T1/T2), publicly demonstrated chemistry experiments (H2, LiH, BeH2, H2O, H-chains, N2, etc.) on each modality, error-mitigation overhead, throughput / wall-clock cost of a VQE iteration, and the qualitative trade-offs (all-to-all vs nearest-neighbor connectivity, gate speed vs fidelity, scalability path).
**Out of scope**: Fault-tolerant / surface-code chemistry estimates (post-NISQ), neutral-atom and photonic platforms, classical-simulation rivalry, business / cloud-pricing comparisons.
**Deliverable**: Markdown report, ~1500–2500 words, with a comparison table and inline citations.
**Success criteria**:
- Each headline claim cites a primary source (peer-reviewed paper, vendor whitepaper, or arXiv preprint) dated 2017 or later.
- Largest published chemistry experiment on each platform is identified with its qubit count and Hamiltonian.
- Report includes an explicit "what I couldn't verify" section.
- All cited URLs pass the liveness check in Phase 5.

## Sub-questions
1. What are the current (2023–2025) state-of-the-art single- and two-qubit gate fidelities, gate times, T1/T2 coherence, and connectivity on leading trapped-ion vs superconducting NISQ devices?
2. What is the largest molecule / Hamiltonian that has been simulated end-to-end (variationally or otherwise) on each platform, and what error-mitigation techniques were required?
3. How do the two modalities compare on circuit-depth budget for chemistry: how many two-qubit gates can a VQE ansatz contain before noise washes out the signal, and how does that map to molecule size?
4. How does qubit connectivity (all-to-all in ion traps vs heavy-hex / fixed-coupler in superconducting) affect the gate count of common chemistry ansätze (UCCSD, hardware-efficient, ADAPT-VQE)?
5. How do wall-clock throughput and shot cost compare? Ion-trap gates are ~100 µs–1 ms; superconducting ~20–500 ns. What does this mean for a million-shot VQE optimization?
6. What error-mitigation methods (ZNE, PEC, symmetry verification, virtual distillation, post-selection) have been demonstrated on each platform for chemistry, and at what overhead?
7. What is the consensus, if any, on which platform currently delivers more chemically meaningful results in the NISQ regime, and where is each headed in the next 1–2 years?

## Source-quality bar
- **Prefer**: peer-reviewed journals (Nature, Science, PRX, npj QI, Phys. Rev. X Quantum, JCTC), arXiv preprints from established groups (IBM, Google, IonQ, Quantinuum, Innsbruck, Maryland, ETH, Yale, Berkeley, Oak Ridge), vendor technical reports with named authors and reproducible benchmarks, NIST and DOE reports.
- **Acceptable**: named-author technical blog posts from practitioners (e.g. IBM Quantum blog, Quantinuum, IonQ), conference proceedings (QIP, APS March Meeting talks if recorded).
- **Avoid**: SEO content farms, undated articles, unsourced aggregators, AI content mills, generic explainer sites, marketing one-pagers without metric tables, listicles.
