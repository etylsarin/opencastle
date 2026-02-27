import * as React from 'react';
import { StaticImage } from 'gatsby-plugin-image';
import dashboardSnapshot from '../images/dashboard-snapshot.svg';

const DEMO_URL = '#demo'; // Placeholder URL for the demo site

const agents = [
  { name: 'Team Lead', tier: 'premium' },
  { name: 'Architect', tier: 'premium' },
  { name: 'Security Expert', tier: 'premium' },
  { name: 'Developer', tier: 'standard' },
  { name: 'UI/UX Expert', tier: 'standard' },
  { name: 'Content Engineer', tier: 'standard' },
  { name: 'Database Engineer', tier: 'standard' },
  { name: 'Performance Expert', tier: 'standard' },
  { name: 'API Designer', tier: 'standard' },
  { name: 'Testing Expert', tier: 'utility' },
  { name: 'Data Expert', tier: 'utility' },
  { name: 'DevOps Expert', tier: 'utility' },
  { name: 'Release Manager', tier: 'utility' },
  { name: 'Documentation Writer', tier: 'economy' },
  { name: 'Researcher', tier: 'economy' },
  { name: 'Copywriter', tier: 'economy' },
  { name: 'SEO Specialist', tier: 'economy' },
];

const features = [
  {
    icon: 'orchestrator',
    title: 'Team Lead Orchestrator',
    description:
      'A single coordinator that analyzes, decomposes, delegates, and verifies work across specialist agents — never writes code itself.',
  },
  {
    icon: 'agents',
    title: '17 Specialist Agents',
    description:
      'From frontend developer to security expert, each with curated tools, model tiers, and domain-specific skills.',
  },
  {
    icon: 'skills',
    title: '27 On-Demand Skills',
    description:
      'Modular knowledge files loaded per task. Keeps context windows lean while enabling deep domain expertise.',
  },
  {
    icon: 'workflows',
    title: '8 Workflow Templates',
    description:
      'Reproducible execution plans for features, bug fixes, data pipelines, schema changes, security audits, and more.',
  },
  {
    icon: 'shield',
    title: 'Quality Gates',
    description:
      'Panel majority vote with independent reviewers, deterministic lint/test/build checks, and browser testing at multiple breakpoints.',
  },
  {
    icon: 'brain',
    title: 'Self-Improvement',
    description:
      'Agents capture lessons learned from retries and failures, then graduate them into permanent instructions.',
  },
];

const workflows = [
  { name: 'feature-implementation', description: 'Brainstorm → Research → Foundation → Integration → Validation → QA Gate' },
  { name: 'bug-fix', description: 'Triage & Reproduce → Root Cause Analysis → Fix → Verification' },
  { name: 'data-pipeline', description: 'Source Analysis → Scraping → Processing → Validation → Import' },
  { name: 'security-audit', description: 'Scope → Automated Checks → Manual Review → Panel Review → Remediation' },
  {
    name: 'performance-optimization',
    description: 'Baseline Measurement → Analysis → Optimization → Verification',
  },
  { name: 'schema-changes', description: 'Schema Analysis → Implementation → Query Updates → Page Integration → Verification' },
  { name: 'database-migration', description: 'Planning → Migration → Type Generation → Code Integration → Rollback Test' },
  { name: 'refactoring', description: 'Scope & Baseline → Test Coverage → Refactor → Verification → Panel Review' },
];

const IndexPage = () => {
  return (
    <>
      {/* ==================== Header ==================== */}
      <header className="header">
        <div className="header__inner">
          <a href="#top" className="header__logo">
            <StaticImage
              src="../images/opencastle-logo.png"
              alt="OpenCastle"
              height={72}
              placeholder="none"
              layout="fixed"
            />
          </a>
          <nav>
            <ul className="header__nav">
              <li>
                <a href="#features">Features</a>
              </li>
              <li>
                <a href="#agents">Agents</a>
              </li>
              <li>
                <a href="#structure">Install</a>
              </li>
              <li>
                <a href="#workflows">Workflows</a>
              </li>
              <li>
                <a href="#dashboard">Observability</a>
              </li>
              <li>
                <a href="#compatible">Integrations</a>
              </li>
            </ul>
          </nav>
          <a
            href="https://github.com/etylsarin/opencastle"
            className="header__cta"
            target="_blank"
            rel="noopener noreferrer"
          >
            <GitHubIcon />
            GitHub
          </a>
        </div>
      </header>

      {/* ==================== Hero ==================== */}
      <section className="hero" id="top">
        <div className="hero__content">
          <div className="hero__illustration">
            <StaticImage
              src="../images/opencastle-illustration.png"
              alt="OpenCastle illustration"
              width={360}
              placeholder="none"
              layout="fixed"
            />
          </div>
          <span className="hero__badge">Open Source · MIT License</span>
          <h1 className="hero__title">
            AI agents that build
            <br />
            <span className="hero__title-gradient">software together.</span>
          </h1>
          <p className="hero__description">
            OpenCastle turns GitHub Copilot, Cursor, and Claude Code into
            coordinated multi-agent development teams. One orchestrator.
            Seventeen specialists. Zero chaos.
          </p>
          <div className="hero__actions">
            <a
              href="https://github.com/etylsarin/opencastle"
              className="btn btn--primary"
              target="_blank"
              rel="noopener noreferrer"
            >
              Get Started
              <ArrowIcon />
            </a>
            <a href="#dashboard" className="btn btn--secondary">
              View Observability
            </a>
          </div>
        </div>
      </section>

      {/* ==================== Features ==================== */}
      <section className="section section--border-top" id="features">
        <div className="container">
          <span className="section__label">Capabilities</span>
          <h2 className="section__title">
            Everything you need to orchestrate AI agents at scale.
          </h2>
          <p className="section__subtitle">
            A complete framework of instructions, skills, agent definitions,
            workflow templates, and quality gates — battle-tested on a production
            codebase.
          </p>
          <div className="features-grid">
            {features.map((f) => (
              <div className="feature-card" key={f.title}>
                <div className="feature-card__icon"><FeatureIcon name={f.icon} /></div>
                <h3 className="feature-card__title">{f.title}</h3>
                <p className="feature-card__description">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== Agents ==================== */}
      <section className="section section--border-top" id="agents">
        <div className="container">
          <span className="section__label">Agent Ecosystem</span>
          <h2 className="section__title">
            Specialized agents, intelligent routing.
          </h2>
          <p className="section__subtitle">
            17 specialist agents, each with its own model tier, tool access, and
            file partition. The Team Lead orchestrator routes tasks based on
            complexity scoring.
          </p>
          <div className="agents-grid">
            {agents.map((a) => (
              <div className="agent-chip" key={a.name}>
                <span className={`agent-chip__dot agent-chip__dot--${a.tier}`} />
                <span className="agent-chip__name">{a.name}</span>
              </div>
            ))}
          </div>
          <div className="tier-grid">
            <div className="tier-card">
              <div className="tier-card__tier tier-card__tier--premium">
                Premium
              </div>
              <div className="tier-card__model">Claude Opus 4.6</div>
              <div className="tier-card__use">
                Architecture, security, orchestration
              </div>
            </div>
            <div className="tier-card">
              <div className="tier-card__tier tier-card__tier--standard">
                Standard
              </div>
              <div className="tier-card__model">Gemini 3.1 Pro</div>
              <div className="tier-card__use">
                Features, schemas, UI
              </div>
            </div>
            <div className="tier-card">
              <div className="tier-card__tier tier-card__tier--utility">Utility</div>
              <div className="tier-card__model">GPT-5.3-Codex</div>
              <div className="tier-card__use">
                Testing, pipelines, deploy
              </div>
            </div>
            <div className="tier-card">
              <div className="tier-card__tier tier-card__tier--economy">
                Economy
              </div>
              <div className="tier-card__model">GPT-5 mini</div>
              <div className="tier-card__use">Documentation</div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== Structure ==================== */}
      <section className="section section--border-top" id="structure">
        <div className="container">
          <span className="section__label">Installation</span>
          <h2 className="section__title">
            One command. Any IDE.
          </h2>
          <p className="section__subtitle">
            Run <code>npx opencastle init</code> and select your IDE. The CLI
            generates the right file format automatically — Copilot agents,
            Cursor .mdc rules, or Claude Code commands — plus MCP server configs.
          </p>
          <div className="code-block">
            <div className="code-block__header">
              <span className="code-block__dot" />
              <span className="code-block__dot" />
              <span className="code-block__dot" />
            </div>
            <div className="code-block__body">
              <pre>
                <span className="code-comment">{'# Install OpenCastle'}</span>
                {'\n'}
                <span className="code-folder">{'$ npx opencastle init'}</span>
                {'\n\n'}
                <span className="code-comment">{'# Choose your IDE:'}</span>
                {'\n'}
                <span className="code-folder">{'  1) VS Code'}{'      '}</span>
                <span className="code-comment">{'— .github/ agents, instructions, skills'}</span>
                {'\n'}
                <span className="code-folder">{'  2) Cursor'}{'       '}</span>
                <span className="code-comment">{'— .cursorrules & .cursor/rules/*.mdc'}</span>
                {'\n'}
                <span className="code-folder">{'  3) Claude Code'}{'  '}</span>
                <span className="code-comment">{'— CLAUDE.md & .claude/ commands'}</span>
                {'\n\n'}
                <span className="code-comment">{'# Other commands'}</span>
                {'\n'}
                <span className="code-folder">{'$ npx opencastle update'}{'  '}</span>
                <span className="code-comment">{'# Update framework, preserve customizations'}</span>
                {'\n'}
                <span className="code-folder">{'$ npx opencastle diff'}{'    '}</span>
                <span className="code-comment">{'# Preview what update would change'}</span>
                {'\n'}
                <span className="code-folder">{'$ npx opencastle eject'}{'   '}</span>
                <span className="code-comment">{'# Remove dependency, keep files'}</span>
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== Workflows ==================== */}
      <section className="section section--border-top" id="workflows">
        <div className="container">
          <span className="section__label">Workflow Templates</span>
          <h2 className="section__title">
            Reproducible execution plans for every task type.
          </h2>
          <p className="section__subtitle">
            8 workflow templates define phases, agent assignments, exit criteria,
            and file partitions. 8 prompt templates cover common tasks from
            brainstorming to PR reviews.
          </p>
          <table className="workflow-table">
            <thead>
              <tr>
                <th>Template</th>
                <th>Pipeline</th>
              </tr>
            </thead>
            <tbody>
              {workflows.map((w) => (
                <tr key={w.name}>
                  <td>{w.name}</td>
                  <td>{w.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ==================== Quality Gates ==================== */}
      <section className="section section--border-top" id="quality">
        <div className="container">
          <span className="section__label">Quality Gates</span>
          <h2 className="section__title">
            No code ships without verification.
          </h2>
          <p className="section__subtitle">
            Multi-layered quality assurance — from automated lint checks to
            panel reviews with three independent AI reviewers.
          </p>
          <div className="quality-grid">
            <div className="quality-card">
              <h3 className="quality-card__title">
                <span style={{ opacity: 0.5 }}>01</span> Deterministic Checks
              </h3>
              <p className="quality-card__description">
                Lint, type-check, unit tests, and build verification run
                automatically after every agent output. No false positives.
              </p>
            </div>
            <div className="quality-card">
              <h3 className="quality-card__title">
                <span style={{ opacity: 0.5 }}>02</span> Panel Majority Vote
              </h3>
              <p className="quality-card__description">
                Three isolated reviewer sub-agents evaluate high-stakes changes.
                2/3 majority wins. BLOCK items become fix requests, not stop
                signals.
              </p>
            </div>
            <div className="quality-card">
              <h3 className="quality-card__title">
                <span style={{ opacity: 0.5 }}>03</span> Browser Testing
              </h3>
              <p className="quality-card__description">
                Chrome DevTools MCP validates UI changes at three breakpoints:
                Mobile (375px), Tablet (768px), Desktop (1440px).
              </p>
            </div>
            <div className="quality-card">
              <h3 className="quality-card__title">
                <span style={{ opacity: 0.5 }}>04</span> Self-Review
              </h3>
              <p className="quality-card__description">
                Every agent is asked: "What edge cases am I missing? What test
                coverage is incomplete? What assumptions could be wrong?"
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== Observability ==================== */}
      <section className="section section--border-top" id="dashboard">
        <div className="container">
          <span className="section__label">Observability</span>
          <h2 className="section__title">
            Track every delegation, every session, every lesson.
          </h2>
          <p className="section__subtitle">
            A real-time dashboard shows agent performance, model tier
            distribution, session timelines, and panel review outcomes.
          </p>
          <a
            href={DEMO_URL}
            className="dashboard-preview"
            title="View live demo (coming soon)"
          >
            <img
              src={dashboardSnapshot}
              alt="OpenCastle Agent Dashboard — showing session metrics, model tier distribution, and recent agent sessions"
            />
            <div className="dashboard-preview__overlay">
              View live demo →
            </div>
          </a>
        </div>
      </section>

      {/* ==================== Stats ==================== */}
      <section className="section section--border-top">
        <div className="container">
          <span className="section__label">By the Numbers</span>
          <h2 className="section__title">
            A complete orchestration framework, out of the box.
          </h2>
          <p className="section__subtitle">
            99 source files, 52K+ words of curated knowledge, and everything
            you need to run a coordinated AI development team — from agent
            definitions to quality gates.
          </p>
          <div className="stats-row" style={{ marginTop: 32 }}>
            <div className="stat">
              <div className="stat__value">17</div>
              <div className="stat__label">Specialist Agents</div>
            </div>
            <div className="stat">
              <div className="stat__value">27</div>
              <div className="stat__label">On-Demand Skills</div>
            </div>
            <div className="stat">
              <div className="stat__value">8</div>
              <div className="stat__label">Workflow Templates</div>
            </div>
            <div className="stat">
              <div className="stat__value">3</div>
              <div className="stat__label">IDE Adapters</div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== Integrations ==================== */}
      <section className="section section--border-top" id="compatible">
        <div className="container">
          <span className="section__label">Pre-Configured Integrations</span>
          <h2 className="section__title">
            MCP servers, ready to connect.
          </h2>
          <p className="section__subtitle">
            OpenCastle ships with Model Context Protocol server configs for
            popular services. Agents get direct tool access — no manual
            wiring required.
          </p>
          <div className="integrations-grid">
            <div className="integration-card">
              <CompatIcon name="linear" />
              <div className="integration-card__info">
                <span className="integration-card__name">Linear</span>
                <span className="integration-card__desc">Issue tracking &amp; task management</span>
              </div>
            </div>
            <div className="integration-card">
              <IntegrationIcon name="supabase" />
              <div className="integration-card__info">
                <span className="integration-card__name">Supabase</span>
                <span className="integration-card__desc">Database, auth &amp; type generation</span>
              </div>
            </div>
            <div className="integration-card">
              <IntegrationIcon name="sanity" />
              <div className="integration-card__info">
                <span className="integration-card__name">Sanity</span>
                <span className="integration-card__desc">Headless CMS &amp; content queries</span>
              </div>
            </div>
            <div className="integration-card">
              <IntegrationIcon name="vercel" />
              <div className="integration-card__info">
                <span className="integration-card__name">Vercel</span>
                <span className="integration-card__desc">Deployment &amp; environment management</span>
              </div>
            </div>
            <div className="integration-card">
              <IntegrationIcon name="chrome" />
              <div className="integration-card__info">
                <span className="integration-card__name">Chrome DevTools</span>
                <span className="integration-card__desc">Browser testing &amp; visual validation</span>
              </div>
            </div>
            <div className="integration-card">
              <CompatIcon name="slack" />
              <div className="integration-card__info">
                <span className="integration-card__name">Slack</span>
                <span className="integration-card__desc">Notifications &amp; team updates</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== CTA ==================== */}
      <section className="cta-section section--border-top">
        <div className="container">
          <h2 className="cta-section__title">
            Ready to orchestrate?
          </h2>
          <p className="cta-section__subtitle">
            One command to install. One Team Lead to coordinate. Seventeen
            specialists ready to build.
          </p>
          <div className="hero__actions" style={{ position: 'relative', zIndex: 1 }}>
            <a
              href="https://github.com/etylsarin/opencastle"
              className="btn btn--primary"
              target="_blank"
              rel="noopener noreferrer"
            >
              Get Started
              <ArrowIcon />
            </a>
            <a
              href="https://github.com/etylsarin/opencastle"
              className="btn btn--secondary"
              target="_blank"
              rel="noopener noreferrer"
            >
              <GitHubIcon />
              Star on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* ==================== Footer ==================== */}
      <footer className="footer">
        <div className="footer__inner">
          <span className="footer__copyright">
            MIT License · Filip Mares · 2026
          </span>
          <ul className="footer__links">
            <li>
              <a
                href="https://github.com/etylsarin/opencastle"
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub
              </a>
            </li>
            <li>
              <a
                href="https://github.com/etylsarin/opencastle/blob/main/LICENSE"
                target="_blank"
                rel="noopener noreferrer"
              >
                License
              </a>
            </li>
          </ul>
        </div>
      </footer>
    </>
  );
};

export default IndexPage;

export const Head = () => (
  <>
    <title>OpenCastle — Multi-Agent Orchestration for AI Coding Assistants</title>
    <meta
      name="description"
      content="Open-source framework that turns GitHub Copilot, Cursor, and Claude Code into coordinated multi-agent development teams."
    />
    <meta name="theme-color" content="#0a0a0f" />
    <link rel="icon" type="image/png" sizes="32x32" href="/opencastle/favicon-32.png" />
    <link rel="icon" type="image/png" sizes="192x192" href="/opencastle/icon-192.png" />
    <link rel="apple-touch-icon" href="/opencastle/favicon-180.png" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
  </>
);

/* ---- Inline SVG Icons ---- */

const featureIcons = {
  orchestrator: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" /><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
    </svg>
  ),
  agents: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  skills: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  ),
  workflows: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="13 17 18 12 13 7" /><polyline points="6 17 11 12 6 7" />
    </svg>
  ),
  shield: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  brain: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" /><line x1="9" y1="21" x2="15" y2="21" />
    </svg>
  ),
};

const FeatureIcon = ({ name }) => featureIcons[name] || null;

const CompatIcon = ({ name }) => {
  const icons = {
    copilot: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M23.922 16.997C23.061 18.492 18.063 22.02 12 22.02 5.937 22.02.939 18.492.078 16.997A.641.641 0 0 1 0 16.741v-2.869a.883.883 0 0 1 .053-.22c.372-.935 1.347-2.292 2.605-2.656.167-.429.414-1.055.644-1.517a10.098 10.098 0 0 1-.052-1.086c0-1.331.282-2.499 1.132-3.368.397-.406.89-.717 1.474-.952C7.255 2.937 9.248 1.98 11.978 1.98c2.731 0 4.767.957 6.166 2.093.584.235 1.077.546 1.474.952.85.869 1.132 2.037 1.132 3.368 0 .368-.014.733-.052 1.086.23.462.477 1.088.644 1.517 1.258.364 2.233 1.721 2.605 2.656a.841.841 0 0 1 .053.22v2.869a.641.641 0 0 1-.078.256Zm-11.75-5.992h-.344a4.359 4.359 0 0 1-.355.508c-.77.947-1.918 1.492-3.508 1.492-1.725 0-2.989-.359-3.782-1.259a2.137 2.137 0 0 1-.085-.104L4 11.746v6.585c1.435.779 4.514 2.179 8 2.179 3.486 0 6.565-1.4 8-2.179v-6.585l-.098-.104s-.033.045-.085.104c-.793.9-2.057 1.259-3.782 1.259-1.59 0-2.738-.545-3.508-1.492a4.359 4.359 0 0 1-.355-.508Zm2.328 3.25c.549 0 1 .451 1 1v2c0 .549-.451 1-1 1-.549 0-1-.451-1-1v-2c0-.549.451-1 1-1Zm-5 0c.549 0 1 .451 1 1v2c0 .549-.451 1-1 1-.549 0-1-.451-1-1v-2c0-.549.451-1 1-1Zm3.313-6.185c.136 1.057.403 1.913.878 2.497.442.544 1.134.938 2.344.938 1.573 0 2.292-.337 2.657-.751.384-.435.558-1.15.558-2.361 0-1.14-.243-1.847-.705-2.319-.477-.488-1.319-.862-2.824-1.025-1.487-.161-2.192.138-2.533.529-.269.307-.437.808-.438 1.578v.021c0 .265.021.562.063.893Zm-1.626 0c.042-.331.063-.628.063-.894v-.02c-.001-.77-.169-1.271-.438-1.578-.341-.391-1.046-.69-2.533-.529-1.505.163-2.347.537-2.824 1.025-.462.472-.705 1.179-.705 2.319 0 1.211.175 1.926.558 2.361.365.414 1.084.751 2.657.751 1.21 0 1.902-.394 2.344-.938.475-.584.742-1.44.878-2.497Z" />
      </svg>
    ),
    cursor: (
      <svg width="32" height="32" viewBox="3.5 2.5 17 19" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M19.2 7.5L12.36 3.55C12.14 3.42 11.86 3.42 11.64 3.55L4.8 7.5C4.61 7.6 4.5 7.8 4.5 8.02V15.99C4.5 16.2 4.61 16.4 4.8 16.5L11.64 20.46C11.86 20.58 12.14 20.58 12.36 20.46L19.2 16.5C19.39 16.4 19.5 16.2 19.5 15.99V8.02C19.5 7.8 19.39 7.6 19.2 7.5Z" />
        <path fill="var(--bg-primary, #0a0a0f)" d="M18.77 8.33L12.16 19.78C12.12 19.86 12 19.83 12 19.74V12.24C12 12.09 11.92 11.95 11.79 11.88L5.3 8.13C5.22 8.09 5.25 7.97 5.34 7.97H18.56C18.75 7.97 18.87 8.17 18.77 8.34Z" />
      </svg>
    ),
    claude: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z" />
      </svg>
    ),
    linear: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M2.886 4.18A11.982 11.982 0 0 1 11.99 0C18.624 0 24 5.376 24 12.009c0 3.64-1.62 6.903-4.18 9.105L2.887 4.18ZM1.817 5.626l16.556 16.556c-.524.33-1.075.62-1.65.866L.951 7.277c.247-.575.537-1.126.866-1.65ZM.322 9.163l14.515 14.515c-.71.172-1.443.282-2.195.322L0 11.358a12 12 0 0 1 .322-2.195Zm-.17 4.862 9.823 9.824a12.02 12.02 0 0 1-9.824-9.824Z" />
      </svg>
    ),
    slack: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
      </svg>
    ),
  };
  return icons[name] || null;
};

const IntegrationIcon = ({ name }) => {
  const icons = {
    supabase: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M11.9 1.036c-.015-.986-1.26-1.41-1.874-.637L.764 12.05C-.33 13.427.65 15.455 2.409 15.455h9.579l.113 7.51c.014.985 1.259 1.408 1.873.636l9.262-11.653c1.093-1.375.113-3.403-1.645-3.403h-9.642z" />
      </svg>
    ),
    sanity: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="m23.327 15.205-.893-1.555-4.321 2.632 4.799-6.11.726-.426-.179-.27.33-.421-1.515-1.261-.693.883-13.992 8.186 5.173-6.221 9.636-5.282-.915-1.769-5.248 2.876 2.584-3.106-1.481-1.305-5.816 6.994-5.777 3.168 4.423-5.847 2.771-1.442-.88-1.789-8.075 4.203L6.186 4.43 4.648 3.198 0 9.349l.072.058.868 1.768 5.153-2.683-4.696 6.207.77.617.458.885 5.425-2.974-5.974 7.185 1.481 1.304.297-.358 14.411-8.459-4.785 6.094.078.065-.007.005.992 1.726 6.364-3.877-2.451 3.954 1.642 1.077L24 15.648z" />
      </svg>
    ),
    vercel: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2L2 19.5h20L12 2Z" />
      </svg>
    ),
    chrome: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 0C8.21 0 4.831 1.757 2.632 4.501l3.953 6.848A5.454 5.454 0 0 1 12 6.545h10.691A12 12 0 0 0 12 0zM1.931 5.47A11.943 11.943 0 0 0 0 12c0 6.012 4.42 10.991 10.189 11.864l3.953-6.847a5.45 5.45 0 0 1-6.865-2.29zm13.342 2.166a5.446 5.446 0 0 1 1.45 7.09l.002.001h-.002l-5.344 9.257c.206.01.413.016.621.016 6.627 0 12-5.373 12-12 0-1.54-.29-3.011-.818-4.364zM12 16.364a4.364 4.364 0 1 1 0-8.728 4.364 4.364 0 0 1 0 8.728Z" />
      </svg>
    ),
  };
  return icons[name] || null;
};

const ArrowIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M3.33 8h9.33M8.67 4l4 4-4 4"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const GitHubIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"
    />
  </svg>
);
