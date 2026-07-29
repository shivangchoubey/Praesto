# Praesto Vision

## Overview

Praesto is a hybrid deployment platform that enables developers to deploy applications running on their own machine through a cloud control dashboard.

Unlike traditional cloud deployment platforms, Praesto separates the control plane from the execution plane. The cloud dashboard manages deployments, while the actual application is built and executed on the developer's own machine using a lightweight local agent.

This approach allows developers to deploy applications without renting servers while still getting a real, publicly accessible URL.

---

# The Problem

Modern deployment platforms such as Vercel, Railway, and Render provide an excellent deployment experience, but they rely on cloud infrastructure.

For many students, hobby developers, and early-stage builders:

- Cloud hosting eventually becomes paid.
- Learning infrastructure is expensive.
- Self-hosting is complicated.
- Running Docker manually is repetitive.
- Sharing locally running applications is difficult.

Developers often want the simplicity of cloud deployment without the recurring infrastructure cost.

---

# Our Vision

Praesto aims to make application deployment simple, affordable, and transparent.

A developer should be able to:

1. Login with GitHub.
2. Import a repository.
3. Configure environment variables.
4. Click Deploy.
5. Receive a live public URL.

without purchasing servers or manually configuring networking.

---

# Design Philosophy

Praesto follows five core principles.

## 1. Developer First

Every feature should reduce developer effort.

If a task can be automated safely, Praesto should automate it.

---

## 2. Zero Infrastructure Cost

The platform should not require users to rent a VPS for local development and personal projects.

---

## 3. Transparent Infrastructure

Developers should always know:

- what is happening,
- why it is happening,
- and where their application is running.

Praesto should never hide important deployment steps.

---

## 4. Local Execution

Applications belong to developers.

Praesto should orchestrate deployments rather than own developer workloads.

---

## 5. Learn While Building

Praesto is designed not only as a deployment platform but also as a project that teaches modern deployment architecture, Docker workflows, networking, authentication, and distributed systems.

---

# Target Users

Praesto is built for:

- Students
- Open-source contributors
- Hobby developers
- Freelancers
- Portfolio builders
- Developers learning Docker and deployment

It is not intended to replace enterprise cloud providers.

---

# Non Goals

Praesto is NOT trying to become:

- Kubernetes
- AWS
- Google Cloud
- A managed cloud hosting provider

The goal is to simplify local application deployment, not to compete with enterprise infrastructure.

---

# Success Criteria

Praesto is successful if a developer can:

- Connect GitHub.
- Deploy a repository with one click.
- View deployment logs.
- Receive a public URL.
- Redeploy with minimal effort.
- Understand exactly how deployment works.

---

# Project Status

Current Phase:

Project Foundation

Status:

🚧 Under Active Development