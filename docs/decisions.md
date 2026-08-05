# ADR-001

Title:
Cloud Never Executes Deployments

Status:
Accepted

Context:
Running deployments on the cloud requires paid infrastructure and increases operational complexity.

Decision:
All deployments will execute on the developer's local machine through the Praesto Agent.

Consequences:

Positive:
- Zero infrastructure cost
- Better scalability
- Lightweight cloud

Negative:
- User machine must remain online
- Requires local agent installation