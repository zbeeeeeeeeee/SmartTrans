# SmartTrans User Guide

> A demonstration platform that uses AI-powered traffic accident analysis to make five foundational concepts of enterprise AI tangible and experiential.

---

## Executive Summary

SmartTrans illustrates five concepts that together define the modern AI agent stack. Each concept addresses a distinct question:

| Concept | The Question It Answers |
|---------|------------------------|
| **Prompt** | How do you give an AI a professional identity — so it does not just speak, but says the *right* thing? |
| **Agent** | How do you combine role, knowledge, and tools into a coherent digital specialist that completes tasks, not just generates text? |
| **RAG** | How do you give an AI access to authoritative, updatable reference documents — so it cites facts, not memories? |
| **MCP** | How do you equip an AI with tools — so it executes actions, not just offers advice? |
| **Skills** | How do you make AI expertise modular and swappable — so domain experts, not just engineers, can evolve its capabilities? |

These five concepts form a capability stack. At the base, **Prompts** define professional identity. **Agents** wrap identity, knowledge, and tools into a coherent whole. **RAG** provides authoritative knowledge. **MCP** delivers executable tools. And **Skills** make expertise modular — decoupling capability upgrades from code changes.

This guide explains each concept, why it matters for enterprise AI strategy, and how to experience it directly through the platform.

---

## Core Concepts at a Glance

| Concept | One-Line Understanding |
|---------|----------------------|
| **Prompt** | A "professional contract" between human and AI — defines not what the AI *can* do, but which path it *should* take |
| **Agent** | An AI entity combining role + knowledge + tools — a digital specialist that completes tasks, not a chatbot that answers questions |
| **Structured Output** | The dependable interface between agents — verifiable, transmittable, auditable data structures instead of free-form text |
| **RAG** | Give the AI a reference library — rather than relying on training memory, look up authoritative documents when needed |
| **Vector Embedding** | Making semantics computable — turning "understanding meaning" into a mathematically measurable operation |
| **Tool Calling** | The AI autonomously decides when, which, and how to invoke external tools — crossing from advisor to executor |
| **MCP** | A universal protocol for tool integration — one standard interface connecting AI to any internal or external service |
| **Skill** | A reusable, modular expertise package — upgrade AI capabilities without modifying code, authored by domain experts |

---

## 1. Prompt — The Professional Contract

**The core question**: How do you make an AI go from "chatting" to "being professional"?

### 1.1 Experience the Pipeline

1. Open the system in your browser.
2. Confirm you are on the **「Accident Analysis」** tab.
3. In the left panel **「Case Information」** area:
   - Click `+` to upload traffic accident scene images (multiple images supported).
   - Fill in the **Text Description** field with an accident narrative, for example:
     > At 3:00 PM on June 15, 2024, at a major urban intersection, Vehicle A traveling straight collided with Vehicle B making a left turn. Weather was clear, road surface was dry.
   - Click the **「Start Analysis」** button.
4. Watch the pipeline execute in the right panel and wait for the report to generate.

> 💡 The language switcher in the top-right corner lets you choose English, Simplified Chinese, or Traditional Chinese. The entire pipeline — from system prompts to the final report — operates in your selected language.

![Analysis page screenshot](./images/image-20260626122908535.png)

### 1.2 The Multi-Agent Architecture

The system decomposes a complex analysis task into a relay of four **specialized agents**:

| Stage | Agent | Responsibility |
|-------|-------|----------------|
| ① | Vision Agent | Understand the visual information of the accident scene — vehicles, road conditions, environment |
| ② | Severity Agent | Assess the accident severity level and evaluate personal injury and property damage risks |
| ③ | Liability Agent | Determine fault percentages for each party and cite legal references |
| ④ | Report Agent | Synthesize the distributed analyses into a complete decision-support report |

The status indicator in the top-right corner of each stage updates in real time — `Waiting` → `Analyzing` → `Complete`. This is not magic; it is a **pipeline architecture** at work: the output of one stage is the input to the next.

### 1.3 Why Prompts Matter

Each agent performs as a domain professional because of a carefully designed **prompt** — a structured instruction that defines the AI's "professional identity."

Consider the same accident photo shown to different observers:
- Ask a traffic officer to "describe the scene" → they focus on liability-relevant details.
- Ask an insurance adjuster to "describe the scene" → they focus on loss-relevant details.
- Ask a bystander to "describe the scene" → they might only see "two cars crashed."

The value of a prompt is not in "making the AI speak," but in **making the AI say the right thing**. It transforms a general-purpose model into a domain expert — without retraining the model, only redefining the role.

In SmartTrans, three of the four agents (Severity, Liability, Report) are powered by the same underlying AI model. Yet they behave as entirely different specialists. The difference is entirely in their prompts — each one a precise definition of role, scope, methodology, and output contract.

> **Core insight**: A prompt is a "professional contract" between a human and an AI. It does not change the model's capability boundary, but it determines which path the model takes within that boundary. For enterprise deployment, this means one model can serve dozens of distinct business functions — each defined by its prompt, not its architecture.

### 1.4 Why Multi-Agent

When facing a complex task, the intuitive approach is to "let one AI handle everything." In practice, this often leads to **attention dilution** — the model switches between vision, assessment, and legal reasoning, struggling to go deep on any single dimension.

The multi-agent architecture is fundamentally about **cognitive division of labor**:

- Each agent bears a single responsibility, allowing the prompt to be extremely focused.
- Stages communicate through **structured output** — not "a paragraph of text," but precise fields (severity level, fault percentage, article number).
- Deviations in any single stage can be localized and corrected without contaminating the entire pipeline.

> **Core insight**: Multi-agent is not about "making more AIs work" — it is about "letting each AI do one thing well." This follows the same logic as professional specialization in organizational management: a team of specialists outperforms a single generalist on complex, multi-dimensional tasks.

### 1.5 Structured Output: The Dependable Interface

Every agent's output is not free-form text, but a **rigorously constrained data structure**.

This may appear to be a technical detail, but it represents the threshold where AI crosses from "conversation tool" into "business system." Free-form text can be read by a human, but it cannot be reliably consumed by the next stage in an automated pipeline. Structured data can be validated, transmitted, aggregated, and audited. It is the **dependable interface** between agents, and the foundation on which the entire pipeline runs autonomously.

![Structured output screenshot](./images/image-20260626123015625.png)

---

## 2. Agent — The Digital Specialist

**The core question**: What exactly *is* an Agent, and how does it differ from the chatbots we are familiar with?

### 2.1 What Defines an Agent

An **Agent** is an AI entity that combines three essential elements:

| Element | Provided By | What It Does |
|---------|-------------|--------------|
| **Role** | Prompt | Defines the agent's professional identity, scope, and methodology |
| **Knowledge** | Training data + RAG | Gives the agent access to facts — both what it was trained on and what it can look up |
| **Tools** | MCP | Equips the agent with the ability to act — generate files, query services, retrieve data |

Think of an agent as a **digital specialist**. Like a human expert, it has a defined scope of responsibility, access to reference materials, and the ability to take action. It does not merely respond to prompts — it executes a task end-to-end within its domain.

### 2.2 Agent vs. Chatbot

The distinction between an agent and a chatbot is fundamental to understanding enterprise AI:

| Dimension | Chatbot | Agent |
|-----------|---------|-------|
| **Mode** | Answers questions | Completes tasks |
| **State** | Stateless — each exchange is independent | Stateful — carries context through a multi-step process |
| **Output** | Free-form natural language | Structured, validated data structures |
| **Capability** | Text generation only | Tool-equipped — can retrieve, compute, generate files, call APIs |
| **Reasoning** | Single-turn | Multi-step, autonomous decision-making — decides *when* and *which* tool to invoke |
| **Accountability** | Output cannot be automatically verified | Output is validated against a schema; deviations are caught |

A chatbot tells you what you *should* do. An agent *does* it.

### 2.3 The Four Agents of SmartTrans

In SmartTrans, four specialized agents work in sequence. Each is a self-contained digital specialist:

| Agent | Underlying Model | Its Prompt Defines... | Its Tools Include... |
|-------|-----------------|----------------------|---------------------|
| **Vision Agent** | Qwen3-VL (vision model) | How to observe and describe accident scenes | — (pure perception) |
| **Severity Agent** | DeepSeek-V4 (reasoning) | How to classify damage and assess risk levels | RAG legal references |
| **Liability Agent** | DeepSeek-V4 (reasoning) | How to determine fault and cite legal authority | RAG legal references |
| **Report Agent** | DeepSeek-V4 (reasoning) | How to synthesize findings into a professional report | PDF generation, map geocoding |

They do not "chat" with each other. Each receives the structured output of the previous stage as input, performs its specialized analysis, and produces its own structured output. The pipeline is a **data relay**, not a conversation.

> **Core insight**: An agent is the operational unit of enterprise AI. It is what transforms a general-purpose model into a reliable, auditable, tool-equipped digital worker that can be plugged into a business process.

---

## 3. RAG — The Knowledge Foundation

**The core question**: Where does an AI's knowledge come from? What gives it the authority to say "according to relevant laws and regulations"?

### 3.1 Experience It

1. Switch to the **「Knowledge Base」** tab.
2. Upload traffic regulation documents:
   - Click the **「Add Document」** button.
   - Drag and drop or select a `.md` or `.txt` file (for example, excerpts from the Road Traffic Safety Law).
   - Click **「Upload」** and wait for processing to complete.

![Knowledge base upload screenshot](./images/image-20260626123051052.png)

3. Try **semantic search**:
   - Enter `rear-end collision liability determination` and click **「Search」**.
   - Observe the **distance scores** in the returned results — they measure how semantically close each result is to your query.

4. Return to the **「Accident Analysis」** page, re-run the analysis, and compare the Liability stage output — before and after having a knowledge base.

![Semantic search screenshot](./images/image-20260626123038340.png)

### 3.2 What Changed

Without a knowledge base, the Liability Agent can only say "according to relevant laws and regulations…" — vague, unverifiable, untraceable.

With a knowledge base, it concretely lists:

- Which article of which law is being cited.
- The verbatim text of that article.
- How that article relates to the present case.

![Liability result screenshot 1](./images/image-20260626123126321.png)

![Liability result screenshot 2](./images/image-20260626123139755.png)

Moving from "it is probably something like that" to "it is indeed this article" — this is a qualitative leap in reliability.

### 3.3 The Essence of RAG: A Reference Library, Not a Memory

The core idea of **RAG (Retrieval-Augmented Generation)** is simple yet profound: **rather than making the AI memorize everything, give it a reference library and let it look things up when needed.**

A traditional AI's knowledge comes from its training data — what it "remembers." This creates three unavoidable problems:

| Problem | Nature | RAG's Solution |
|---------|--------|----------------|
| Knowledge cutoff | The world keeps changing after training completes | Documents can be updated anytime; the AI always references the latest version |
| Hallucination risk | When "uncertain," models "fabricate" — and fabricate plausibly | The AI is constrained to cite only real, retrieved documents |
| Domain depth | General-purpose models are inevitably "breadth-first" on specialized domains | Specialist documents build a deep moat of professional knowledge |

> **Core insight**: RAG does not solve "the AI isn't smart enough." It solves "the AI should not make professional judgments from memory." This is the same reason a doctor should not prescribe from memory — they should consult the latest pharmacopoeia. For enterprises, RAG means your proprietary documents, policies, and regulations become the AI's source of truth — updatable by you, auditable by you, controlled by you.

### 3.4 From Documents to Knowledge: Chunking and Vectorization

Uploaded documents are not fed to the AI verbatim. The system does two things worth understanding:

**First, chunking.** The system automatically detects **「Article X」** markers and splits legal texts by article into independent knowledge units. This is not because the AI cannot read long texts, but because **precise retrieval requires precise granularity** — when you ask about "rear-end liability," the system should return the few articles about rear-end collisions, not the entire statute.

**Second, vectorization.** Each knowledge unit is converted into a high-dimensional mathematical vector (4,096 dimensions in SmartTrans). This is not for "encryption" or "compression," but to **make semantics computable**. "Rear-end collision" and "the vehicle behind strikes the rear of the vehicle ahead" are entirely different at the character level, yet extremely close in vector space — because vectors capture *meaning*, not *spelling*.

> **Core insight**: The significance of vectorization is that it turns "understanding meaning" — a uniquely human capability — into a mathematically measurable, sortable, and optimizable computational problem. This is the technical foundation that makes RAG work at scale.

---

## 4. MCP — From Advisor to Executor

**The core question**: Can an AI do more than just "talk" — can it actually "act"?

### 4.1 Prerequisites

The MCP feature must be enabled on the server side (`MCP_ENABLED=true`). If the **「MCP Settings」** tab is not visible in the navigation bar, contact the administrator to confirm the server configuration.

### 4.2 Experience It

1. Switch to the **「MCP Settings」** tab.
2. You will see a connection marked with a <el-tag size="small" type="info">System</el-tag> badge: **「PDF Report Generator」**.
   - It is a system preset and cannot be deleted.
   - It provides one capability: generating a formal PDF document from the analysis report.

![MCP settings screenshot](./images/image-20260626123158034.png)

3. Enable the tool for an agent:
   - Switch to the **「Accident Analysis」** tab.
   - In the pipeline panel on the right, click the gear icon ⚙️ next to the **Report Agent** title (visible when MCP is enabled).
   - In the **「MCP Tools」** tab, find **「PDF Report Generator」** and turn the switch on.
   - Close the dialog.

![MCP tool configuration screenshot](./images/image-20260626123215838.png)

4. Run an analysis with tools enabled:
   - Upload images and description, then click **「Start Analysis」**.
   - After the analysis completes, switch to the **「History」** tab.
   - Locate your report — you will see a **「Download PDF」** button.
   - Click to download a formatted, official report document.

![History report screenshot](./images/image-20260626123242183.png)

### 4.3 The Essence of Tool Calling: Crossing from Advice to Action

In the earlier sections, the AI demonstrated **cognitive ability** — understanding images, assessing risk, retrieving legal references. But cognition typically ends with "producing a paragraph of text." Business value, however, usually requires **action** after the paragraph: generating a file, sending a notification, updating a database.

**Tool Calling** enables the AI to cross this line:

```
Understand the need → autonomously decide which tool to call → pass parameters → receive results → continue reasoning based on results
```

The key is not that "the AI can call a function," but that **the AI itself judges when to call, which tool to call, and how to interpret the result**. This is not a pre-scripted workflow; it is the agent making autonomous decisions at runtime.

> **Core insight**: Without tool-calling capability, an AI is a "consultant" — it can only tell you what you should do. With tool-calling capability, the AI becomes an "executor" — it can go and do it directly. For enterprises, this means AI crosses from "decision support" into "execution replacement." The business case shifts from productivity improvement to process automation.

### 4.4 MCP: A Universal Protocol for Tool Integration

Suppose an enterprise has 10 internal systems and 50 external APIs, each requiring separate adaptation for AI — this is not a technical problem; it is a **scaling problem**.

**MCP (Model Context Protocol)** solves precisely this scaling problem. It defines a standard where:

- Whether a tool is a local script, a remote service, or a cloud API, **the integration method is unified**.
- Regardless of what a tool does, the way the AI discovers, understands, and invokes it is **unified**.
- No matter how many new tools are added in the future, **the extension pattern is unified**.

By analogy: MCP is to the AI tool ecosystem what USB is to the computer peripheral ecosystem. Before USB, every peripheral needed a proprietary port; after USB, one interface connects everything.

> **Core insight**: MCP transforms tool integration from an N×M engineering problem (each AI system × each tool) into a compliance problem (does the tool speak MCP?). For enterprises, this means your existing internal services — databases, ERP systems, mapping services, document generators — can become AI-callable tools through a single standard, not through custom integration projects.

### 4.5 System Connections vs. User Connections

In MCP Settings, connections fall into two categories:

| Type | Characteristics | Management |
|------|----------------|-------------|
| **System Connections** | Preset, non-deletable; represent platform-native capabilities | Maintained and upgraded by the platform |
| **User Connections** | Added by users; represent on-demand external capabilities | Users manage their own lifecycle |

This design reflects an organizational principle: **the platform provides a stable foundation; users inject domain-specific expertise**. System connections define the "out-of-the-box" capability baseline; user connections allow each organization to connect the AI to their own data sources and services, growing the AI's capability map with business needs.

Use the **「Add MCP Server」** button to connect external MCP services — mapping services, weather data, industry databases — letting the AI's capabilities grow organically with your requirements.

---

## 5. Skills — Evolve Without Rewriting Code

**The core question**: Can we upgrade an AI agent's capabilities without touching a single line of code?

### 5.1 Experience It

1. Switch to the **「Skills」** tab in the navigation bar.
2. Observe the four pre-installed system skills — each marked with a <el-tag size="small" type="info">System</el-tag> badge and non-deletable:

   | Skill | Default Agent | Purpose |
   |-------|---------------|---------|
   | `vision-enhancer` | Vision | Vehicle damage classification, road condition grading, weather/lighting impact analysis |
   | `severity-enhancer` | Severity | Injury risk classification, property damage categorization, multi-factor severity matrix |
   | `liability-enhancer` | Liability | Fault assessment criteria, common accident-type responsibility splits, multi-vehicle chain analysis |
   | `report-enhancer` | Report | Structured report template, post-accident action checklists, language consistency rules |

3. Create a custom skill:
   - Click the **「New Skill」** button.
   - In the dialog, paste a SKILL.md document — a text file with YAML frontmatter followed by Markdown instructions. For example:

   ```markdown
   ---
   name: severity-checklist
   description: |
     A structured checklist for comprehensive severity assessment,
     covering vehicle damage grades, injury classification,
     and environmental hazard evaluation.
   ---

   # Severity Assessment Checklist

   ## Instructions

   When assessing accident severity, systematically evaluate:

   ### 1. Vehicle Damage
   - Level A: Cosmetic damage only (scratches, dents)
   - Level B: Functional damage (lights, mirrors, windows)
   - Level C: Structural damage (frame, axles, crumple zones)
   - Level D: Total loss

   ### 2. Injury Classification
   - Minor: Bruises, whiplash — outpatient treatment
   - Moderate: Fractures, lacerations requiring sutures — hospitalization < 7 days
   - Severe: Life-threatening, permanent disability — hospitalization ≥ 7 days
   - Fatal: One or more fatalities

   ### 3. Environmental Hazards
   - Fluid spills (fuel, oil, coolant)
   - Road blockage (partial or full lane closure)
   - Secondary collision risk (blind curves, high-speed traffic)
   ```

   - Click **「Create」** to save.

4. Bind the skill to an agent:
   - Switch to **「Accident Analysis」**.
   - Click the gear icon ⚙️ on the **Severity Agent** to open the Agent Settings dialog.
   - Switch to the **「Skills」** tab.
   - Toggle **`severity-checklist`** on for the Severity agent.
   - Close the dialog.

5. Run an analysis and observe:
   - During pipeline execution, the Severity Agent step displays a yellow <el-tag type="warning">severity-checklist</el-tag> tag, indicating the skill is active.
   - The Severity assessment in the final report reflects the structured checklist approach — more systematic, with explicit damage grades and injury classifications.

### 5.2 What Happened

A **Skill** is a reusable capability package, stored as a `SKILL.md` file under `server/data/skills/<skill-name>/`. Each skill consists of:

- **YAML frontmatter**: metadata — `name` (unique identifier) and `description` (what the skill does).
- **Markdown body**: the actual instructions injected into the agent's system prompt.

When the server starts, the `SkillsManager` parses all SKILL.md files from disk and caches them in memory. When a pipeline analysis is launched:

1. The orchestrator queries the Skills Manager for each agent's enabled skills.
2. This merges persisted agent-skill bindings with any per-session selections from the request.
3. The resulting skill list is formatted with clear boundary markers and appended to the agent's system prompt:

```
--- BEGIN SKILLS ---
[Skill: severity-checklist]
Description: A structured checklist for comprehensive severity assessment...
Instructions:
# Severity Assessment Checklist
...
[/Skill: severity-checklist]
--- END SKILLS ---
```

4. The model reads this as extended domain expertise — as if a senior specialist handed the agent a training manual before it begins work.

### 5.3 Skills in the Capability Stack

We now have four mechanisms for shaping AI agent behavior. Their relationship is critical to understand:

| Mechanism | Metaphor | What It Does |
|-----------|----------|--------------|
| **Prompt** | Job description | Defines the agent's professional role — *what kind of expert it is* |
| **RAG** | Reference library | Gives the agent retrievable knowledge — *what facts it can look up* |
| **MCP / Tools** | Hands and instruments | Gives the agent the ability to act — *what it can do in the world* |
| **Skills** | Training manual | Gives the agent reusable expertise modules — *how it should think and operate* |

Skills occupy a unique position. They are neither reference data (RAG) nor executable functions (MCP) — they are **operational know-how**: heuristics, methodologies, checklists, decision frameworks. The preset `liability-enhancer` doesn't add new law articles; it adds fault-determination heuristics, common accident pattern tables, and multi-vehicle chain analysis methods — the kind of tacit knowledge an experienced adjuster develops over years.

The architectural significance of Skills is this: **they decouple capability upgrades from code changes**. A domain expert — a senior claims adjuster, a legal specialist, a medical reviewer — can author a SKILL.md file and have it injected into the relevant agent's reasoning process. No code deployment, no model retraining, no pipeline reconfiguration. A skill can be enabled, disabled, or updated independently, per agent, per session.

> **Core insight**: Prompts define *what the agent is*. RAG provides *what the agent can reference*. MCP enables *what the agent can do*. Skills define *how the agent thinks* — and they make this "how" modular, swappable, and authorable by domain experts rather than engineers. This is the path from "building an AI system" to "operating an AI workforce."

### 5.4 The SKILL.md Format

Every skill follows a simple convention:

```markdown
---
name: <unique-identifier>
description: |
  <what this skill provides — used for discovery and selection>
---

# <Title>

## Instructions

<The actual guidance, heuristics, checklists, or methodologies
the agent should follow. Use standard Markdown — headings, tables,
lists — to structure the content clearly.>
```

The `name` field is the skill's unique identifier. The `description` appears in the UI to help users understand what the skill does. The body — everything after the second `---` — is the content injected into the agent's system prompt. Write it as if you are writing a training manual for a new employee: clear, structured, and actionable.

---

## Summary: The Five-Layer Capability Stack

| Layer | Concept | The Leap | Business Impact |
|-------|---------|----------|-----------------|
| 1 | **Prompt** | From "can talk" to "says the right thing" | One model serves many business functions — each defined by its prompt |
| 2 | **Agent** | From "a model" to "a digital specialist" | AI becomes an auditable, tool-equipped unit that plugs into business processes |
| 3 | **RAG** | From "remembering" to "looking it up" | Proprietary documents become the AI's source of truth — updatable, auditable, controlled by you |
| 4 | **MCP** | From "advising" to "executing" | Existing enterprise services become AI-callable through one standard protocol |
| 5 | **Skills** | From "built once" to "continuously evolving" | Domain experts upgrade AI capabilities without engineering — like updating a training manual |
