# Praesto Domain Model

## Overview

The domain model defines the core business entities of Praesto and the relationships between them.

These entities represent real-world concepts within the platform and remain independent of database implementation details.

The purpose of this document is to establish a common language for the system before designing the database.

---

# Core Entities

Praesto consists of the following primary entities:

- User
- Agent
- Project
- Deployment
- Environment Variable
- Deployment Log

---

# User

A User represents a developer using Praesto.

## Responsibilities

- Authenticate using GitHub
- Own projects
- Connect a Praesto Agent
- Trigger deployments
- Manage environment variables

## Attributes

- id
- githubId
- username
- email
- avatarUrl
- createdAt
- updatedAt

---

# Agent

An Agent represents the developer's connected machine running the Praesto Agent.

The Agent is responsible for executing deployments on the user's machine.

## Responsibilities

- Maintain a connection with Praesto Cloud
- Receive deployment requests
- Clone or update repositories
- Build Docker images
- Run Docker containers
- Stream deployment logs
- Manage Cloudflare Tunnel
- Report deployment and machine status

## Attributes

- id
- userId
- machineName
- operatingSystem
- status
- lastHeartbeat
- version
- createdAt
- updatedAt

## Version 1 Rule

- Each user can have **one active Agent** in Version 1.
- The Agent belongs to exactly one user.
- The Agent may execute multiple deployments.

Future versions may support multiple Agents per user, but this is outside the scope of Version 1.

---

# Project

A Project represents a GitHub repository connected to Praesto.

## Responsibilities

- Store repository metadata
- Track deployments
- Store project configuration

## Attributes

- id
- userId
- repositoryName
- repositoryUrl
- defaultBranch
- framework
- visibility
- createdAt
- updatedAt

---

# Deployment

A Deployment represents one deployment attempt of a Project.

Every deployment has its own lifecycle.

## Responsibilities

- Track deployment progress
- Track deployment status
- Store deployment metadata
- Associate a deployment with the Agent that executed it

## Attributes

- id
- projectId
- agentId
- commitHash
- status
- publicUrl
- startedAt
- completedAt
- duration

---

# Environment Variable

An Environment Variable represents configuration associated with a Project.

## Responsibilities

- Store runtime configuration
- Provide configuration during deployment
- Store sensitive values securely

## Attributes

- id
- projectId
- key
- value
- createdAt
- updatedAt

---

# Deployment Log

A Deployment Log represents a log entry generated during a deployment.

## Responsibilities

- Provide real-time deployment information
- Preserve deployment history
- Assist with debugging failed deployments

## Attributes

- id
- deploymentId
- timestamp
- level
- message

---

# Relationships

User

↓

owns

↓

Projects

↓

create

↓

Deployments

↓

generate

↓

Deployment Logs

---

User

↓

connects

↓

Agent

↓

executes

↓

Deployments

---

Project

↓

contains

↓

Environment Variables

---

# Entity Relationship Overview

```text
User
│
├── Projects
│     │
│     ├── Deployments
│     │      │
│     │      └── Deployment Logs
│     │
│     └── Environment Variables
│
└── Agent
       │
       └── Executes Deployments
```

---

# Lifecycle

```text
User
  │
  ▼
GitHub Authentication
  │
  ▼
Import Repository
  │
  ▼
Create Project
  │
  ▼
Connect Agent
  │
  ▼
Deploy
  │
  ▼
Deployment Created
  │
  ▼
Repository Prepared
  │
  ▼
Application Built
  │
  ▼
Container Started
  │
  ▼
Public URL Generated
  │
  ▼
Deployment Completed
```

---

# Business Rules

## User

- A user may own multiple projects.
- A user may have one active Agent in Version 1.
- A user may trigger multiple deployments.

---

## Agent

- An Agent belongs to exactly one user.
- Version 1 supports one active Agent per user.
- An Agent may execute multiple deployments.
- An Agent must be connected before it can receive deployment commands.

---

## Project

- A Project belongs to exactly one user.
- A Project may have multiple deployments.
- A Project may have multiple environment variables.

---

## Deployment

- Every deployment belongs to exactly one project.
- Every deployment is executed by one Agent.
- A deployment may generate multiple logs.
- A deployment has a defined lifecycle and status.

---

## Environment Variable

- Every environment variable belongs to exactly one project.
- Environment variable values are sensitive and must be handled securely.

---

## Deployment Log

- Every log entry belongs to exactly one deployment.
- Logs are immutable once created.

---

# Domain Model Principles

The domain model should remain independent of:

- Database technology
- ORM implementation
- API design
- Frontend framework
- Backend framework

It represents the business model of Praesto rather than its technical implementation.

---

# Version 1 Scope

Version 1 includes:

- One User → One active Agent
- One User → Multiple Projects
- One Project → Multiple Deployments
- One Project → Multiple Environment Variables
- One Deployment → Multiple Logs
- One Agent → Multiple Deployments

Multi-agent support is intentionally excluded from Version 1.

---

# Status

Approved