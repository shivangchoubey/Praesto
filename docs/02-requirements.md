# Praesto Requirements

## Introduction

This document defines the functional and non-functional requirements for Praesto.

The purpose of this document is to clearly define the scope of the project before implementation begins.

---

# Functional Requirements

## Authentication

- Users should be able to log in using GitHub OAuth.
- Users should be able to securely log out.
- User sessions should be securely managed.

---

## Repository Management

- Users should be able to view their GitHub repositories.
- Users should be able to select a repository for deployment.
- Both public and private repositories should be supported.

---

## Deployment

- Users should be able to deploy a repository with a single click.
- The deployment request should be sent to the connected Praesto Agent.
- Deployments should execute on the user's own machine.
- Users should be able to redeploy an existing project.

---

## Environment Variables

- Users should be able to configure environment variables.
- Environment variables should be available during deployment.
- Sensitive values should never be displayed after being saved.

---

## Build Process

The Praesto Agent should:

- Clone or update the repository.
- Detect the project framework.
- Build the project.
- Start the application.
- Stream deployment logs.

---

## Deployment Logs

- Users should be able to view live deployment logs.
- Deployment logs should remain available after deployment completes.
- Failed deployments should include error logs.

---

## Public URL

- Every successful deployment should generate a publicly accessible URL.
- Users should be able to copy the deployment URL.
- Users should be able to open the deployed application directly from the dashboard.

---

## Deployment Status

Each deployment should display one of the following states:

- Pending
- Building
- Running
- Failed
- Offline

---

## Agent Connectivity

- Users should be able to connect their machine using the Praesto Agent.
- The dashboard should display whether the agent is online or offline.
- Deployments should only begin when the agent is connected.

---

## Deployment History

Users should be able to:

- View previous deployments.
- View deployment timestamps.
- View deployment status.
- Redeploy previous versions.

---

# Non-Functional Requirements

## Security

- Permanent GitHub credentials must never be exposed to the Praesto Agent.
- Sensitive information should be encrypted where appropriate.
- Authentication should follow the principle of least privilege.

---

## Performance

- Dashboard interactions should remain responsive.
- Deployment logs should stream in near real time.
- The platform should avoid unnecessary network traffic.

---

## Reliability

- The agent should recover gracefully from temporary failures where possible.
- Failed deployments should provide meaningful error information.

---

## Scalability

The architecture should allow additional deployment providers and features to be added without major redesign.

---

## Maintainability

- Components should remain modular.
- Documentation should be maintained alongside implementation.
- Major architectural decisions should be documented.

---

## Portability

The agent should be designed to support multiple operating systems in future versions.

---

# Out of Scope (Version 1)

The following features are intentionally excluded from the first release:

- Kubernetes
- Multi-node deployments
- Auto scaling
- Load balancing
- Custom CI/CD pipelines
- Team collaboration
- Billing and subscriptions
- Enterprise authentication
- Multi-cloud deployment
- Container orchestration

---

# Success Criteria

Version 1 will be considered successful if a user can:

- Log in with GitHub.
- Connect a Praesto Agent.
- Select a repository.
- Configure environment variables.
- Deploy with one click.
- View deployment logs.
- Receive a public URL.
- Redeploy the application.

---

# Current Version

Target Release:

Praesto v1.0