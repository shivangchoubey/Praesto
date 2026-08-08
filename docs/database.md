# Praesto Database Design

## Overview

Praesto uses a cloud-hosted relational database to store platform metadata and deployment information.

The database stores information about:

- Users
- Connected Agents
- Projects
- Deployments
- Environment Variables
- Deployment Logs

The Praesto database belongs to the Control Plane and is not installed on or managed by the user's machine.

Application source code, Docker images, containers, and build artifacts are not stored in the Praesto database.

---

# Database Technology

Praesto will use:

- PostgreSQL
- Prisma ORM
- A managed cloud PostgreSQL provider

The managed PostgreSQL database will be hosted using a free-tier provider such as Neon or Supabase during Version 1.

The final provider will be selected during implementation based on current free-tier availability and project requirements.

PostgreSQL is selected because Praesto has clear relationships between its core entities and requires reliable relational data and constraints.

Prisma will provide type-safe database access for the backend.

---

# Database Location

The Praesto PostgreSQL database is part of the Praesto Cloud Control Plane.

```text
User
 │
 ▼
Praesto Dashboard
 │
 ▼
Praesto Backend
 │
 ▼
Managed PostgreSQL
```

The Praesto Agent does not connect directly to PostgreSQL.

Instead:

```text
Praesto Agent
      │
      │ REST / WebSocket
      ▼
Praesto Backend
      │
      ▼
PostgreSQL
```

The backend is responsible for all database operations.

---

# Core Entities

The database contains the following primary entities:

- User
- Agent
- Project
- Deployment
- EnvironmentVariable
- DeploymentLog

---

# User

Represents a developer using Praesto.

| Field | Type | Constraints |
|---|---|---|
| id | UUID | Primary Key |
| githubId | String | Unique, Required |
| username | String | Required |
| email | String | Required |
| avatarUrl | String | Optional |
| createdAt | DateTime | Required |
| updatedAt | DateTime | Required |

## Relationships

- A User can have multiple Projects.
- A User can have one active Agent in Version 1.

---

# Agent

Represents the Praesto Agent running on the user's machine.

| Field | Type | Constraints |
|---|---|---|
| id | UUID | Primary Key |
| userId | UUID | Foreign Key, Unique |
| machineName | String | Required |
| operatingSystem | String | Required |
| status | Enum | Required |
| lastHeartbeat | DateTime | Optional |
| version | String | Required |
| createdAt | DateTime | Required |
| updatedAt | DateTime | Required |

## Relationships

- An Agent belongs to exactly one User.
- An Agent can execute multiple Deployments.

## Version 1 Constraint

`userId` is unique so that each User can have only one Agent in Version 1.

---

# Project

Represents a GitHub repository connected to Praesto.

| Field | Type | Constraints |
|---|---|---|
| id | UUID | Primary Key |
| userId | UUID | Foreign Key |
| repositoryName | String | Required |
| repositoryUrl | String | Required |
| defaultBranch | String | Required |
| framework | String | Optional |
| visibility | Enum | Required |
| createdAt | DateTime | Required |
| updatedAt | DateTime | Required |

## Relationships

- A Project belongs to exactly one User.
- A Project can have multiple Deployments.
- A Project can have multiple Environment Variables.

---

# Deployment

Represents one deployment attempt of a Project.

| Field | Type | Constraints |
|---|---|---|
| id | UUID | Primary Key |
| projectId | UUID | Foreign Key |
| agentId | UUID | Foreign Key |
| commitHash | String | Required |
| status | Enum | Required |
| publicUrl | String | Optional |
| startedAt | DateTime | Optional |
| completedAt | DateTime | Optional |
| duration | Integer | Optional |
| createdAt | DateTime | Required |

## Relationships

- A Deployment belongs to exactly one Project.
- A Deployment is executed by one Agent.
- A Deployment can have multiple Deployment Logs.

---

# Environment Variable

Represents configuration associated with a Project.

| Field | Type | Constraints |
|---|---|---|
| id | UUID | Primary Key |
| projectId | UUID | Foreign Key |
| key | String | Required |
| value | String | Required |
| createdAt | DateTime | Required |
| updatedAt | DateTime | Required |

## Constraints

The combination of:

```text
projectId + key
```

must be unique.

This prevents the same environment variable from being defined multiple times for the same Project.

---

# Deployment Log

Represents a single log entry generated during a Deployment.

| Field | Type | Constraints |
|---|---|---|
| id | UUID | Primary Key |
| deploymentId | UUID | Foreign Key |
| timestamp | DateTime | Required |
| level | Enum | Required |
| message | Text | Required |

## Relationships

- A Deployment Log belongs to exactly one Deployment.
- A Deployment can have multiple Deployment Logs.

---

# Entity Relationships

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

Detailed relationships:

```text
User 1 ──────── N Project

User 1 ──────── 1 Agent       (Version 1)

Project 1 ───── N Deployment

Agent 1 ─────── N Deployment

Project 1 ───── N EnvironmentVariable

Deployment 1 ── N DeploymentLog
```

---

# Enumerations

## AgentStatus

```text
ONLINE
OFFLINE
```

---

## ProjectVisibility

```text
PUBLIC
PRIVATE
```

---

## DeploymentStatus

```text
PENDING
BUILDING
RUNNING
FAILED
OFFLINE
```

---

## LogLevel

```text
INFO
WARN
ERROR
```

---

# Primary Keys

All primary keys will use UUIDs.

UUIDs provide:

- Globally unique identifiers
- Better separation between internal IDs and sequential database IDs
- Safer exposure of identifiers through APIs

---

# Foreign Keys

The following relationships use foreign keys:

```text
Agent.userId → User.id

Project.userId → User.id

Deployment.projectId → Project.id

Deployment.agentId → Agent.id

EnvironmentVariable.projectId → Project.id

DeploymentLog.deploymentId → Deployment.id
```

---

# Constraints

The database should enforce important business rules where possible.

### Agent

```text
Agent.userId must be UNIQUE
```

This ensures one Agent per User in Version 1.

### Environment Variables

```text
(projectId, key) must be UNIQUE
```

This prevents duplicate environment variable keys within the same Project.

### Required Relationships

A Deployment cannot exist without:

- A Project
- An Agent

A Deployment Log cannot exist without:

- A Deployment

---

# Indexes

Indexes should be created for frequently queried fields.

Initial indexes include:

```text
User.githubId

Agent.userId

Project.userId

Deployment.projectId

Deployment.agentId

Deployment.status

DeploymentLog.deploymentId

EnvironmentVariable.projectId
```

---

# Cascade Rules

## User Deletion

If a User is deleted:

- Their Projects should be deleted.
- Their Agent should be deleted.
- Their Deployments should be deleted through their Projects.
- Their Environment Variables should be deleted through their Projects.
- Their Deployment Logs should be deleted through their Deployments.

---

## Project Deletion

If a Project is deleted:

- Its Deployments should be deleted.
- Its Environment Variables should be deleted.
- Its Deployment Logs should be deleted through its Deployments.

---

## Deployment Deletion

If a Deployment is deleted:

- Its Deployment Logs should be deleted.

---

# Data Ownership

The Praesto database stores platform metadata only.

The following data is NOT stored in PostgreSQL:

- Repository source code
- GitHub repository files
- Docker images
- Docker containers
- Build artifacts
- Tunnel traffic
- Application runtime data

These remain on the user's machine or are handled by external services.

---

# Application Database Separation

A project deployed through Praesto may require its own database.

That database is separate from the Praesto database.

For example:

```text
Praesto PostgreSQL
│
├── Users
├── Projects
├── Deployments
├── Agents
└── Logs


Deployed Application
│
└── Its own database
    ├── Products
    ├── Orders
    └── Customers
```

Praesto does not manage application-specific database data in Version 1.

---

# Security Considerations

Environment variable values may contain sensitive information.

Therefore:

- Environment variable values must not be returned in plaintext through normal project listing APIs.
- Environment variable values must not appear in deployment logs.
- Sensitive values should be encrypted at rest.
- Access to environment variables must be restricted to the authenticated Project owner.
- The Praesto Agent should not have direct database access.
- Database credentials must remain on the Praesto Backend and must never be exposed to the Agent or frontend.

---

# Database Access Model

Only the Praesto Backend communicates directly with PostgreSQL.

```text
                    PostgreSQL
                        ▲
                        │
                 Database Access
                        │
                        ▼
                 Praesto Backend
                   ▲         ▲
                   │         │
             REST │         │ WebSocket
                   │         │
                   ▼         ▼
              Dashboard    Agent
```

The frontend and Agent never receive PostgreSQL credentials.

---

# Version 1 Scope

Version 1 supports:

- One User → One active Agent
- One User → Many Projects
- One Project → Many Deployments
- One Project → Many Environment Variables
- One Deployment → Many Deployment Logs
- One Agent → Many Deployments
- Cloud-hosted PostgreSQL for Praesto platform metadata
- Managed PostgreSQL through a free-tier provider

Multi-agent support and application-specific database management are outside the scope of Version 1.

---

# Status

Approved