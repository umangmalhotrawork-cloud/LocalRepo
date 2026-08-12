# Echo Nullity

> **Causal Code Tomography Engine for AI-Generated Software**

Echo Nullity is a local-first static analysis and software tomography system designed to detect semantically vacuous yet executable code in AI-generated software systems. Unlike traditional linters, dead-code analyzers, or profilers, Echo Nullity measures **causal necessity**—whether a line of code actually constrains a program's output state.

---

## 🌟 Core Features

- **Causal Luminance**: Per-line measure of logical necessity over program state spaces (0.00 to 1.00).
- **Ghost Code Detection**: Visualizes reachable, executed code that exerts zero causal leverage over return output states.
- **Semantic Tension Mapping**: Cross-function causal equivalence detection using canonicalized AST Tree Edit Distances.
- **Safe Remove AST Surgery Protocol**: Performs verified, reversible semantic surgery on live codebases inside isolated mutation sandboxes.
- **Causal Provenance Replay**: Generates step-by-step human-readable explanation chains proving why candidate lines are mathematically unnecessary.
- **Interactive Tomography Workbench**: Full-screen IDE workbench simulator with live heatmap intensity controls and staged sandbox outputs.

---

## 🛠️ Technology Stack

- **Core Engine**: Rust 1.80+ (petgraph, rmp-serde MessagePack)
- **Parsing Layer**: Tree-sitter (Python, C++, Rust concrete syntax tree parsing)
- **Frontend / Showcase**: Next.js 15+ App Router, React 19, TypeScript, Tailwind CSS, Framer Motion
- **IDE Layer**: TypeScript + VS Code Extension API

---

## 🔬 Academic & Publication Targets

Echo Nullity is framed as a research contribution and measurement instrument aimed at premier software engineering and programming language conferences:

- **PLDI**: *ACM SIGPLAN Conference on Programming Language Design and Implementation*
- **ICSE**: *International Conference on Software Engineering*
- **FSE**: *ACM International Conference on the Foundations of Software Engineering*
- **ASE**: *IEEE/ACM International Conference on Automated Software Engineering*
- **OOPSLA**: *Object-Oriented Programming, Systems, Languages & Applications*

---

## 🚀 Quick Start & Local Run Instructions

### Prerequisites

- Node.js 20+
- npm / pnpm / yarn

### Installation & Run

```bash
# Clone the repository
git clone https://github.com/umangmalhotrawork-cloud/echo-nullity.git
cd echo-nullity

# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to launch the application.

### Building for Production

```bash
npm run build
npm run start
```

---

## 📄 License

This project is licensed under the permissive **MIT License**.
