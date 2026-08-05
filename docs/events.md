# Praesto Event System

## Overview

Praesto is an event-driven platform.

Every major action in the platform is represented as an event.

Events allow the cloud dashboard, agent, and user interface to remain synchronized without tightly coupling different components.

This document defines the events exchanged between the different components of the system.

---

# Event Categories

Praesto events are divided into six categories.

- User Events
- Agent Events
- Deployment Events
- Tunnel Events
- Log Events
- System Events

---

# User Events

These events originate from user interactions.

## USER_LOGIN

Triggered when a user successfully authenticates.

---

## USER_LOGOUT

Triggered when a user signs out.

---

## DEPLOYMENT_REQUESTED

Triggered when the user clicks the Deploy button.

---

## DEPLOYMENT_CANCELLED

Triggered when a deployment is cancelled before completion.

---

## REDEPLOY_REQUESTED

Triggered when the user redeploys an existing project.

---

# Agent Events

These events are produced by the Praesto Agent.

## AGENT_CONNECTED

The agent successfully connects to the cloud.

---

## AGENT_DISCONNECTED

The connection between the agent and cloud is lost.

---

## AGENT_HEARTBEAT

Sent periodically to indicate that the agent is alive.

---

# Deployment Events

These represent the deployment lifecycle.

## DEPLOYMENT_CREATED

A deployment record has been created.

---

## DEPLOYMENT_STARTED

The agent begins processing the deployment.

---

## REPOSITORY_CLONING

Repository clone/update has started.

---

## REPOSITORY_READY

Repository is available locally.

---

## BUILD_STARTED

Application build has started.

---

## BUILD_COMPLETED

Application build completed successfully.

---

## BUILD_FAILED

Application build failed.

---

## CONTAINER_STARTING

Docker container is starting.

---

## CONTAINER_RUNNING

Application is now running.

---

## DEPLOYMENT_COMPLETED

Deployment finished successfully.

---

## DEPLOYMENT_FAILED

Deployment failed.

---

# Tunnel Events

## TUNNEL_STARTING

Tunnel creation has started.

---

## TUNNEL_READY

A public URL has been generated.

---

## TUNNEL_STOPPED

Tunnel has been stopped.

---

## TUNNEL_FAILED

Tunnel creation failed.

---

# Log Events

## LOG_RECEIVED

A deployment log entry has been received.

---

## LOG_STREAM_STARTED

Real-time log streaming begins.

---

## LOG_STREAM_ENDED

Real-time log streaming ends.

---

# System Events

## ENVIRONMENT_UPDATED

Environment variables have changed.

---

## PROJECT_CREATED

A new project has been added.

---

## PROJECT_DELETED

A project has been removed.

---

## PROJECT_UPDATED

Project metadata has been modified.

---

# Event Lifecycle

A typical deployment follows this sequence.

DEPLOYMENT_REQUESTED

↓

DEPLOYMENT_CREATED

↓

DEPLOYMENT_STARTED

↓

REPOSITORY_CLONING

↓

REPOSITORY_READY

↓

BUILD_STARTED

↓

BUILD_COMPLETED

↓

CONTAINER_STARTING

↓

CONTAINER_RUNNING

↓

TUNNEL_STARTING

↓

TUNNEL_READY

↓

DEPLOYMENT_COMPLETED

---

# Failure Flow

If a deployment fails:

DEPLOYMENT_REQUESTED

↓

DEPLOYMENT_STARTED

↓

BUILD_STARTED

↓

BUILD_FAILED

↓

DEPLOYMENT_FAILED

---

# Design Principles

Every event should:

- Represent a completed action or state transition.
- Have a clear and descriptive name.
- Be immutable.
- Be traceable to a deployment.
- Be timestamped.

---

# Status

Version 1.0