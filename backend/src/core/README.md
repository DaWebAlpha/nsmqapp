# Core Infrastructure Modules Documentation

This document provides a comprehensive overview of the core infrastructure modules used in the Node.js enterprise backend. All modules are located in the src/core folder.

The modules covered include:

### Logger (logger.js) – Enterprise logging strategy

### MongoDB (database.js) – Centralized connection engine using Mongoose

### Redis (redis.js) – High-performance in-memory store for sessions, rate-limiting, and temporary state

Each module includes purpose, configuration, operational guidelines, and production hardening considerations.


### 1. Logger Selection Strategy

We selected **Pino** as the core logging framework for this system.

Alternative solutions evaluated:

* Winston
* Bunyan

#### 1.1 Performance

Pino is widely recognized as one of the fastest logging libraries in the Node.js ecosystem. It is optimized for:

* Minimal overhead
* High-throughput applications
* Low-latency API environments

In enterprise systems, logging must never become a performance bottleneck.


#### 1.2 JSON-First Architecture
Pino logs in structured JSON format by default. This provides:
* Machine-readable logs
* Schema consistency
* Direct compatibility with log aggregation tools

Our logs integrate cleanly with:

* Splunk
* Datadog
* Elastic Stack

Structured logging eliminates fragile string parsing and improves query performance in centralized logging systems.

#### 1.3 Worker Thread Transports

Pino transports execute in separate worker threads. This ensures:

* Non-blocking log writes
* No event-loop interruption
* Stable response times under load

Disk I/O operations occur asynchronously, protecting application performance in production environments.


### 2. Log Rotation Strategy (pino-roll)

Logging to a single file indefinitely is a risk to system stability. We use `pino-roll` to enforce controlled log rotation.

#### 2.1 Disk Protection

Log files are capped using:

```
size: '20m'
```

This guarantees:

* No uncontrolled file growth
* Protection against disk exhaustion
* Operational safety in long-running systems

Unbounded logs can cause server crashes and service outages.

#### 2.2 Automatic Archiving

`pino-roll` automatically:

* Rotates files when size or date thresholds are reached
* Appends timestamps to archived logs
* Maintains historical audit records without manual intervention

Example:

```
app-info.2026-03-02.1.log
app-access.2026-03-02.1.log
app-audit.2026-03-02.1.log
```

This aligns with enterprise log retention policies.

---

### 3. Logger Isolation Strategy

The system exports three distinct logger instances:

* `system_logger`
* `audit_logger`
* `access_logger`

#### 3.1 Security and Compliance Separation

Logs are segregated by responsibility:

* **System logs** contain operational and lifecycle events.
* **Audit logs** contain sensitive user and security actions.
* **Access logs** contain HTTP traffic data.

This separation prevents:

* Sensitive audit data from mixing with high-volume access logs
* Accidental data leakage across log categories
* Compliance violations during reviews

Segregation is critical for regulatory frameworks such as:

* GDPR
* SOC 2
* ISO 27001

#### 3.2 Independent Rotation and Scaling

Different log types have different operational profiles:

| Logger | Typical Volume | Rotation Strategy           |
| ------ | -------------- | --------------------------- |
| Access | High           | Daily                       |
| System | Medium         | Daily                       |
| Audit  | Low            | Daily with longer retention |

Isolation allows each logger to scale independently.

---

### 4. Code Architecture Overview


#### 4.1 DEPENDENCIES AND IMPORTED FILES

``` javascript
import pino from 'pino';
import fs from 'node:fs';
import path from 'node:path';
import config from '../config/config.js';
Use code with caution.
```


**Detailed Component Breakdown**

**import pino from 'pino'**
* The Engine: This is the primary logging library.
* Why it's here: We use Pino because it is a low-overhead logger. 
* In an enterprise environment, we cannot allow the logging process to consume more CPU than the actual business logic. 
* It handles the generation of JSON logs and manages the worker threads that offload I/O tasks.

**import fs from 'node:fs'**
* The File System: A native Node.js module used to interact with the server's physical storage.
* Why it's here: This is responsible for Directory Provisioning. Before any log is written, fs checks if the folders exist. 
* If they are missing, it creates them. This prevents the application from crashing with a fatal ENOENT error ("Error NO ENTry" (or "Error No Entity")).

**import path from 'node:path'**
* The Navigator: A native Node.js utility for handling file and directory paths.
* Why it's here: Different operating systems use different path separators (Windows uses "\\", while Linux/Unix uses /). path.join() ensures that our log paths (e.g., logs/system/app-info) are cross-platform compatible, meaning the code works the same on a developer's laptop and a production cloud server.

**import config from '../config/config.js'**
* The Intelligence: This imports our application's centralized settings.
* Why it's here: It provides the logger with environmental context. 
* It tells the system whether it is running in Development (where we need noisy debug logs) or Production (where we restrict output to info to save disk space and maximize performance).

---

#### 4.2 Environment Detection and Log Level Control

```javascript
const isDevelopment = config.node_env === 'development';
const logLevel = config.log_level || (isDevelopment ? 'debug' : 'info');
```

**Purpose**

* Enables verbose debugging in development environments
* Restricts verbosity in production for performance optimization
* Allows override via configuration

This ensures operational efficiency while preserving developer visibility.

---

#### 4.2 Directory Provisioning (Fail-Safe Mechanism)

```javascript
const targetdir = './logs';
if (!fs.existsSync(targetdir)) {
    fs.mkdirSync(targetdir, { recursive: true });
}
```

**Purpose**

* Guarantees that the logging directory exists before initialization
* Prevents runtime crashes caused by missing directories
* Supports nested paths through `recursive: true`

This protects system availability during deployment or infrastructure changes.

---

#### 4.3 Blueprint Factory Pattern

```javascript
const blueprint = (filelocation, rollfrequency, fileSize, minLevel = 'info') => { ... }
```

**Purpose**

* Eliminates configuration duplication
* Standardizes `pino-roll` setup
* Enforces consistent naming and rotation policies

Key Configuration Elements:

* `sync: false`
  Ensures logs are written asynchronously via worker threads.

* `dateFormat: 'yyyy-MM-dd'`
  Standardizes file naming to enterprise conventions.

Example output:

```
system/app-info.2026-03-02.log
```

---

#### 4.4 Multi-Stream Transport Configuration

```javascript
const system_transport = pino.transport({
    targets: [
        blueprint('system/app-info', 'daily', '20m', 'info'),
        blueprint('errors/app-error', 'daily', '20m', 'error'),
        ...log_to_terminal
    ]
});
```

**Operational Behavior**

* `app-info` captures logs at `info` level and above.
* `app-error` filters exclusively `error` level and higher.
* Terminal output is enabled only in development environments.

This ensures proper routing and filtering of log events.

---

#### 4.5 ISO Timestamp Standardization

```javascript
timestamp: pino.stdTimeFunctions.isoTime,
```

By default, Pino logs epoch timestamps. We override this to ISO 8601 format:

```
2026-03-02T14:32:18.123Z
```

Advantages:

* Human-readable
* Timezone standardized
* Compatible with distributed systems

---

#### 4.6 Level Label Injection

```javascript
mixin(_context, levelNumber) {
    const labels = { 10: 'trace', 20: 'debug', 30: 'info', 40: 'warn', 50: 'error', 60: 'fatal' };
    return { levelLabel: labels[levelNumber] || 'info' };
}
```

Pino internally uses numeric log levels:

| Level | Numeric Value |
| ----- | ------------- |
| trace | 10            |
| debug | 20            |
| info  | 30            |
| warn  | 40            |
| error | 50            |
| fatal | 60            |

Numeric levels are retained for:

* Performance
* Reduced file size
* Compatibility with log ingestion systems

The `mixin` function injects a human-readable `levelLabel` without disrupting transport stability.

---

#### 4.7 Redaction Policy (Security Control)

```javascript
redact: {
    paths: [
                'password', '*.password', 'token', '*.token', 
                'apiKey', 'ssn', 'req.headers.authorization', 'req.headers.cookie'
            ],
    remove: true
}
```

**Purpose**

* Automatically removes sensitive fields before logs are written
* Prevents accidental exposure of credentials
* Protects against compliance violations

This is a mandatory safeguard for enterprise environments handling authentication or personally identifiable information.

---

### 5. Logger Responsibilities

#### 5.1 system_logger

Primary operational logger.

Captures:

* Application lifecycle events
* Service startup/shutdown
* Background task execution
* Error events

Serves as the central operational ledger.

---

#### 5.2 audit_logger

Security-focused logger.

Captures:

* User role changes
* Permission updates
* Account modifications
* Authentication events

Used during compliance audits and forensic investigations.

---

#### 5.3 access_logger

HTTP request logger.

Captures:

* Request method
* Endpoint
* Response status
* Latency
* Client metadata

High-volume but operationally essential.

---

### 6. Architectural Summary

This logging infrastructure provides:

* High-performance structured logging
* Non-blocking disk operations
* Automatic log rotation
* Log isolation by responsibility
* Data redaction safeguards
* Compliance-aligned separation of concerns
* Production-grade observability readiness

This architecture is designed for enterprise-scale Node.js systems requiring performance, traceability, and regulatory compliance.













# Database Infrastructure Module
Module Path
## src/core/database.js
### 1. Overview

The Database Infrastructure Module is the centralized MongoDB connection engine for the application.

It is responsible for securely establishing and monitoring the application's connection to the MongoDB cluster using Mongoose ODM.

This module enforces:

* Secure environment-based configuration

* Observability through structured logging

* Safe failure behavior if the database is unreachable


### 2. Compliance Alignment
* SOC 2 – Availability

* Ensures database connectivity is verified at application bootstrap.

* Logs connection failures immediately for operational response.

* NIST – Infrastructure Security

* Uses environment-driven configuration.

* Prevents hardcoded credentials.

* Implements structured logging for traceability.


### 3. Responsibilities
#### 3.1 Secure Singleton Connection

Establishes a single MongoDB connection using mongoose.connect().

Prevents multiple redundant connection attempts.

#### 3.2 Real-Time Observability

Successful connections are logged via system_logger.info.
Failures are logged via system_logger.error.
Errors include structured metadata (err.message).


#### 3.3 Safe Failure Handling
If the database connection fails:
The error is logged.
The error is re-thrown.
The application can be prevented from starting without a data layer.
This ensures fail-safe system behavior.

### 4. Dependencies
#### 4.1 Mongoose
import mongoose from 'mongoose';
Used as the Object Data Modeling (ODM) layer for MongoDB.


#### 4.2 Configuration Layer
import config from "../config/config.js";

Provides the MongoDB connection string via:

config.mongo_uri

This value is expected to be sourced from encrypted environment variables.

#### 4.3 System Logger
import { system_logger } from './logger.js';
Used for structured logging of:
Successful connections
Database failures

### 5. Configuration Constant
MONGO_URI
const MONGO_URI = config.mongo_uri;
Purpose
Stores the authenticated MongoDB connection string.
Security Design
Derived from environment variables
Not hardcoded
Supports secret rotation without code changes

### 6. Database Connection Bootstrap
Function: connectDB
const connectDB = async () => { ... }
Description

Initializes the asynchronous handshake with MongoDB.

### 7. Execution Flow
#### 7.1 Success Path

Calls:

await mongoose.connect(MONGO_URI);

On successful connection:
system_logger.info("Database successfully connected");
Connection pool becomes active.

#### 7.2 Connection Options Explained
##### 7.2.1 serverSelectionTimeoutMS: 5000
Purpose

Controls how long Mongoose waits while trying to select a MongoDB server before throwing an error.

Why 5000ms?

Default behavior may wait up to 30 seconds.

30 seconds creates poor user experience during outages.

5 seconds ensures:
* Faster failure detection
* Faster alerting
* Faster container restart (if orchestrated)


Enterprise Benefit
Improves resilience in distributed environments.
Reduces hanging requests.
Aligns with high-availability infrastructure practices.


##### 7.2.2 minPoolSize: 5
Purpose

Maintains a minimum number of active connections in the MongoDB connection pool.

Why This Matters
Without warm connections:
First incoming user may experience latency.
Cold-start queries can be slower.
With minPoolSize: 5:
Five connections remain ready.
Reduces initial query latency.
Improves performance consistency.
Enterprise Benefit
Predictable response times.
Better handling of moderate traffic spikes.
Reduced connection negotiation overhead.



##### 7.2.3 maxPoolSize: 50

Purpose

Defines the maximum number of concurrent connections that the application can open to the MongoDB cluster.

Why 20?

Without a defined upper limit:

The application may open excessive connections under high load.

Database resources (CPU, memory, sockets) can become exhausted.

Other services sharing the same cluster may be impacted.

With maxPoolSize: 20:

Connection growth is controlled.

Database load remains predictable.

Resource utilization is stabilized.

The number 20 is an example baseline. In production, this value should be determined based on:

Expected concurrent request volume

Database hardware capacity

Horizontal scaling strategy

Enterprise Benefit

Prevents connection storms.

Protects database stability.

Enforces infrastructure-level capacity control.

Enables predictable performance under load.

##### 7.2.4 retryWrites: true

Purpose

Enables automatic retry of certain transient write operations when using MongoDB replica sets or sharded clusters.

Why Enable Retry Writes?

In distributed environments, transient failures can occur due to:

Temporary network interruptions

Primary node failover

Replica election events

Without retryWrites:

Some write operations may fail unnecessarily.

Clients may receive avoidable errors.

With retryWrites: true:

Safe write operations are retried automatically.

Transient infrastructure issues are masked from end users.

Application resilience increases.

Enterprise Benefit

Improves reliability in distributed clusters.

Reduces user-visible failures.

Enhances fault tolerance during failover events.

Aligns with cloud-native resilience standards.



#### 7.3 Failure Path

If connection fails:
system_logger.error(
    { error: err.message },
    "Database Connection Failure - Service Unavailable"
);
Failure Handling Strategy
Captures exact error message
Logs structured metadata
Provides clear operational alerting
Then:
throw err;
This ensures:
The server does not silently continue
DevOps/SRE teams are alerted immediately
Infrastructure issues are visible


### 8. MongoDB Connection Pool Calculation
#### 8.1 Total Connection Limit Formula

Purpose

Ensure total MongoDB connections remain below server limits to avoid crashes.

Formula

Total Connections = (S × C) × N × (MPS + 2)

Variables

Variable	Description
S	Number of servers
C	Number of PM2 workers per server
N	Number of MongoDB nodes (replica set)
MPS	maxPoolSize per process
+2	Extra monitoring sockets per node

Enterprise Benefit
Prevents exceeding DB limits
Ensures stable, predictable behavior
Avoids production outages

### 8.2 Ideal maxPoolSize Formula

Purpose

Determine the most efficient maxPoolSize based on traffic to avoid over-provisioning.

Formula

Ideal MPS = [(Total RPS / Total Processes) × Latency] × 1.5

Variables

Variable	Description
Total RPS	Peak Requests Per Second
Total Processes	Total PM2 processes across all servers
Latency	Average DB response time in seconds
1.5	Safety buffer for traffic spikes

Enterprise Benefit

Right-sizes connections

Reduces memory overhead

Improves performance predictability

8.3 Example Calculation

Infrastructure

Servers: 3

PM2 Workers per server: 4

MongoDB Nodes: 3

Peak RPS: 1200

DB Latency: 0.04s

Total Connections (Limit Formula)

Total = (3 × 4) × 3 × (50 + 2) = 12 × 3 × 52 = 1872

MongoDB max connections must be >1872 to prevent overload.

Ideal maxPoolSize (Tuning Formula)

Ideal MPS = [(1200 / 12) × 0.04] × 1.5 = 6

Recommended: maxPoolSize = 6 per process.

### 8.4 Production Hardening Considerations

Use waitQueueTimeoutMS to fail fast if all connections busy

Use minPoolSize to prevent cold-start latency

Use serverSelectionTimeoutMS to detect outages quickly

Monitor connections via db.serverStatus().connections

Review tuning after traffic changes

Enterprise Benefit

Prevents partial startup without DB

Supports fast failover in container orchestration (Docker/Kubernetes)

Maintains high availability and resilience



#### 9. Export
export default connectDB;

This allows the module to be imported and invoked during application bootstrap.








Redis Connection Layer Documentation
1. Overview

The Redis Connection Layer provides a centralized interface for connecting to Redis, which is used for:

Rate-limiting login attempts

Session and token tracking

Temporary in-memory state storage

Security & Compliance Rationale

Brute-force mitigation: Requires fast, in-memory counters for login attempts

Reliability monitoring: Redis failures must be logged and immediately visible

Fail-safe design: Critical authentication flows should fail gracefully if Redis is unavailable

Module: src/core/redis
Compliance: SOC2 (Availability & Security), NIST (Infrastructure Monitoring)

2. Initialization
import Redis from 'ioredis';
import config from '../config/config.js';
import { system_logger } from './logger.js';

const redis = new Redis(config.redis_uri);

Purpose

Establish a persistent, high-performance connection to Redis using the configured URL

Use ioredis for advanced connection handling, failover support, and cluster awareness

Enterprise Benefit

Centralized connection management

Supports enterprise-scale session and token operations

Simplifies audit logging and monitoring

3. Connection Event Handlers
3.1 Success Handler
redis.on('connect', () => {
    system_logger.info("Redis connected successfully");
});

Purpose

Log every successful connection for audit traceability

Confirms infrastructure is available and operational

Enterprise Benefit

Immediate visibility into system readiness

Supports compliance audits and operational monitoring

3.2 Error Handler
redis.on("error", (err) => {
    system_logger.error({ error: err.message }, "Could not connect Redis");
});

Purpose

Capture Redis connection failures immediately

Prevent silent failures that can compromise authentication or rate-limiting

Include full error stack for rapid incident response

Enterprise Benefit

Enables proactive monitoring and alerting

Reduces MTTR (Mean Time to Recovery) for Redis-related outages

Ensures critical flows degrade gracefully instead of failing silently

4. Operational Guidelines

Retry Logic: Consider using built-in ioredis reconnection strategies for transient network issues

Monitoring: Integrate with monitoring tools (Prometheus, Datadog) to track connection counts and latency

Failover: For high availability, use Redis Cluster or Sentinel

Security: Ensure Redis credentials are encrypted and not hard-coded; use environment variables

5. Enterprise Hardening Considerations

Connection Pooling: Configure multiple connections if Redis is heavily used by multiple processes

Timeouts: Set connectTimeout and maxRetriesPerRequest to avoid hanging operations

Logging: Log all errors to secure audit logs

Fail-Fast Design: If Redis is critical (e.g., for authentication), fail early to prevent partial service startup





















