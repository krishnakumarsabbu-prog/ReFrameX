"""Generate default_ruleset_v2.json according to Part A requirements:
- ruleset_id: default_ruleset_v2, version 2.0.0
- baselines: complexity 0, confidence 0, readiness 0
- hyperbolic_k: 20.0
- coverage_cap: linear multiplier 100.0
- Rescaled points so positive rules sum to 100 per domain for confidence and readiness
- Target-neutral recommendations and candidate_considerations
"""

import json
from pathlib import Path
import jsonschema

CURRENT_DIR = Path(__file__).resolve().parent
RULESET_DIR = CURRENT_DIR / "rulesets"
SCHEMA_FILE = CURRENT_DIR / "ruleset_schema.json"

DOMAINS = [
    "application_business_logic",
    "data_structures",
    "database_persistence",
    "jobs_batch_orchestration",
    "online_transactions_ui",
    "integration_external_dependencies",
    "security_controls",
    "operational_nonfunctional",
]

DOMAIN_WEIGHTS = {
    "application_business_logic": 0.18,
    "data_structures": 0.12,
    "database_persistence": 0.15,
    "jobs_batch_orchestration": 0.12,
    "online_transactions_ui": 0.15,
    "integration_external_dependencies": 0.12,
    "security_controls": 0.08,
    "operational_nonfunctional": 0.08,
}

THRESHOLDS = {
    "complexity": {"low": 35, "medium": 65},
    "confidence": {"low": 40, "medium": 70},
    "readiness": {"low": 40, "medium": 70},
}

BASE_CONSIDERATIONS = [
    "Hypothesis for further evaluation: Refactor in place within modern language runtime",
    "Hypothesis for further evaluation: Decompose into distributed microservices",
    "Hypothesis for further evaluation: Containerized platform such as OpenShift as ONE possible target",
    "Hypothesis for further evaluation: Retain on mainframe with API wrapper",
]

# Read v1 to preserve existing complexity rules
with open(RULESET_DIR / "archive" / "default_ruleset_v1.json", "r", encoding="utf-8") as f:
    v1 = json.load(f)

v2_rules = []

# 1. Complexity rules: copy from v1, ensure target-neutral wording and candidate_considerations
for r in v1["rules"]:
    if r["measure"] == "complexity":
        r_copy = dict(r)
        # Neutralize any target-specific wording
        rec = r_copy.get("recommendation") or ""
        rec = rec.replace("React SPA", "modern web interface")
        rec = rec.replace("OpenShift", "containerized platform or modern cloud runtime")
        rec = rec.replace("Tekton", "cloud-native orchestration pipeline")
        r_copy["recommendation"] = rec
        r_copy["candidate_considerations"] = list(BASE_CONSIDERATIONS)
        v2_rules.append(r_copy)

# 2. Confidence rules: Exactly 100 points maximum achievable positive points per domain
CONFIDENCE_RULES = [
    # application_business_logic (sum = 100)
    {
        "rule_id": "CF-AB-001",
        "domain": "application_business_logic",
        "measure": "confidence",
        "description": "Evidence-based components in application logic increase confidence",
        "detection_condition": "component.evidence_class == 'Evidence-based'",
        "weight": 60,
        "impact": "positive",
        "severity": "info",
        "evidence_requirement": "component evidence_class Evidence-based",
        "explanation": "Directly observed and parsed application logic components provide high evidential confidence.",
        "recommendation": "Maintain verified source artifacts in version control.",
        "upgrade_guidance": None,
        "candidate_considerations": BASE_CONSIDERATIONS,
    },
    {
        "rule_id": "CF-AB-003",
        "domain": "application_business_logic",
        "measure": "confidence",
        "description": "COBOL programs with full parse status increase confidence",
        "detection_condition": "artifact_category == 'COBOL' and artifact.support_level == 'SUPPORTED_PARSE'",
        "weight": 40,
        "impact": "positive",
        "severity": "info",
        "evidence_requirement": "COBOL artifact with SUPPORTED_PARSE",
        "explanation": "Full static parsing confirms that all procedural divisions and statements are recognized.",
        "recommendation": "Confirm procedural syntax compatibility with target execution runtime.",
        "upgrade_guidance": None,
        "candidate_considerations": BASE_CONSIDERATIONS,
    },
    {
        "rule_id": "CF-AB-002",
        "domain": "application_business_logic",
        "measure": "confidence",
        "description": "Inferred components reduce confidence due to indirect evidence",
        "detection_condition": "component.evidence_class == 'Inferred'",
        "weight": -15,
        "impact": "negative",
        "severity": "low",
        "evidence_requirement": "component evidence_class Inferred",
        "explanation": "Inferred elements indicate indirect runtime relationships that require manual verification.",
        "recommendation": "Verify inferred references with system subject matter experts.",
        "upgrade_guidance": None,
        "candidate_considerations": BASE_CONSIDERATIONS,
    },

    # data_structures (sum = 100)
    {
        "rule_id": "CF-DS-001",
        "domain": "data_structures",
        "measure": "confidence",
        "description": "Copybook source artifacts available increase data structure confidence",
        "detection_condition": "has_copybooks",
        "weight": 60,
        "impact": "positive",
        "severity": "info",
        "evidence_requirement": "Copybook artifacts uploaded",
        "explanation": "Presence of copybooks enables complete schema mapping for record layouts.",
        "recommendation": "Validate copybook field alignments across consuming programs.",
        "upgrade_guidance": None,
        "candidate_considerations": BASE_CONSIDERATIONS,
    },
    {
        "rule_id": "CF-DS-003",
        "domain": "data_structures",
        "measure": "confidence",
        "description": "All referenced copybook dependencies fully resolved",
        "detection_condition": "no_unknown_copybooks",
        "weight": 40,
        "impact": "positive",
        "severity": "info",
        "evidence_requirement": "Zero unresolved copybook references",
        "explanation": "Resolving all copybook inclusions provides 100% data definition visibility.",
        "recommendation": "Catalogue shared record definitions into modern data contracts.",
        "upgrade_guidance": None,
        "candidate_considerations": BASE_CONSIDERATIONS,
    },
    {
        "rule_id": "CF-DS-002",
        "domain": "data_structures",
        "measure": "confidence",
        "description": "Missing copybook artifacts referenced in code reduce confidence",
        "detection_condition": "has_unknown_copybooks",
        "weight": -25,
        "impact": "negative",
        "severity": "high",
        "evidence_requirement": "unresolved copybook components",
        "explanation": "Unresolved copybooks introduce risk of missing data fields and misaligned memory layouts.",
        "recommendation": "Upload all referenced copybook files before modernization planning.",
        "upgrade_guidance": None,
        "candidate_considerations": BASE_CONSIDERATIONS,
    },

    # database_persistence (sum = 100)
    {
        "rule_id": "CF-DB-001",
        "domain": "database_persistence",
        "measure": "confidence",
        "description": "SQL DDL artifacts available increase database confidence",
        "detection_condition": "has_ddl",
        "weight": 60,
        "impact": "positive",
        "severity": "info",
        "evidence_requirement": "SQL DDL artifacts uploaded",
        "explanation": "DDL scripts provide schema definitions and relational constraints.",
        "recommendation": "Map relational schemas to target database models.",
        "upgrade_guidance": None,
        "candidate_considerations": BASE_CONSIDERATIONS,
    },
    {
        "rule_id": "CF-DB-003",
        "domain": "database_persistence",
        "measure": "confidence",
        "description": "Embedded SQL table references verified against DDL schemas",
        "detection_condition": "has_ddl and has_embedded_sql",
        "weight": 40,
        "impact": "positive",
        "severity": "info",
        "evidence_requirement": "Embedded SQL and DDL both present",
        "explanation": "Correlating embedded SQL statements with table definitions verifies query consistency.",
        "recommendation": "Plan automated data migration pipelines.",
        "upgrade_guidance": None,
        "candidate_considerations": BASE_CONSIDERATIONS,
    },
    {
        "rule_id": "CF-DB-002",
        "domain": "database_persistence",
        "measure": "confidence",
        "description": "Embedded SQL without table names reduces database understanding",
        "detection_condition": "embedded_SQL_detected_but_no_DDL",
        "weight": -20,
        "impact": "negative",
        "severity": "medium",
        "evidence_requirement": "SQL detected without corresponding DDL",
        "explanation": "Missing DDL prevents verification of table schemas and indexes.",
        "recommendation": "Provide DDL scripts for all tables referenced in SQL queries.",
        "upgrade_guidance": None,
        "candidate_considerations": BASE_CONSIDERATIONS,
    },

    # jobs_batch_orchestration (sum = 100)
    {
        "rule_id": "CF-JB-001",
        "domain": "jobs_batch_orchestration",
        "measure": "confidence",
        "description": "JCL artifacts with full parse status increase batch confidence",
        "detection_condition": "has_jcl",
        "weight": 60,
        "impact": "positive",
        "severity": "info",
        "evidence_requirement": "JCL artifacts uploaded with full parse status",
        "explanation": "Parsed JCL steps document batch execution sequence and dataset dependencies.",
        "recommendation": "Model batch workflows into target workflow orchestrators.",
        "upgrade_guidance": None,
        "candidate_considerations": BASE_CONSIDERATIONS,
    },
    {
        "rule_id": "CF-JB-003",
        "domain": "jobs_batch_orchestration",
        "measure": "confidence",
        "description": "Batch job stream datasets and step conditions fully mapped",
        "detection_condition": "has_jcl and has_cobol",
        "weight": 40,
        "impact": "positive",
        "severity": "info",
        "evidence_requirement": "JCL and batch programs both parsed",
        "explanation": "Mapping JCL execution steps to target batch programs confirms batch job boundaries.",
        "recommendation": "Design cloud-native batch execution jobs.",
        "upgrade_guidance": None,
        "candidate_considerations": BASE_CONSIDERATIONS,
    },
    {
        "rule_id": "CF-JB-002",
        "domain": "jobs_batch_orchestration",
        "measure": "confidence",
        "description": "Missing JCL artifacts reduce batch confidence",
        "detection_condition": "has_cobol and not has_jcl",
        "weight": -30,
        "impact": "negative",
        "severity": "high",
        "evidence_requirement": "COBOL present without JCL",
        "explanation": "Batch programs without JCL lack execution context, schedules, and file parameters.",
        "recommendation": "Upload all corresponding JCL job streams.",
        "upgrade_guidance": None,
        "candidate_considerations": BASE_CONSIDERATIONS,
    },

    # online_transactions_ui (sum = 100)
    {
        "rule_id": "CF-OL-001",
        "domain": "online_transactions_ui",
        "measure": "confidence",
        "description": "BMS map artifacts available increase online UI confidence",
        "detection_condition": "has_bms",
        "weight": 60,
        "impact": "positive",
        "severity": "info",
        "evidence_requirement": "BMS map artifacts uploaded",
        "explanation": "Screen maps define UI layout, user input fields, and terminal interactions.",
        "recommendation": "Map 3270 screen fields to RESTful API payloads and modern UI components.",
        "upgrade_guidance": None,
        "candidate_considerations": BASE_CONSIDERATIONS,
    },
    {
        "rule_id": "CF-OL-002",
        "domain": "online_transactions_ui",
        "measure": "confidence",
        "description": "CICS transaction identifiers correlated with UI mapsets",
        "detection_condition": "has_bms and has_cics_transactions",
        "weight": 40,
        "impact": "positive",
        "severity": "info",
        "evidence_requirement": "CICS transactions and BMS maps present",
        "explanation": "Correlating transaction codes with screen maps provides end-to-end interactive flow clarity.",
        "recommendation": "Refactor pseudo-conversational state into stateless microservices.",
        "upgrade_guidance": None,
        "candidate_considerations": BASE_CONSIDERATIONS,
    },

    # integration_external_dependencies (sum = 100)
    {
        "rule_id": "CF-IX-002",
        "domain": "integration_external_dependencies",
        "measure": "confidence",
        "description": "Dependency discovery completed increases integration confidence",
        "detection_condition": "dependency_count > 0",
        "weight": 60,
        "impact": "positive",
        "severity": "info",
        "evidence_requirement": "Dependency graph populated",
        "explanation": "Extracted CALL, COPY, and dataset linkages provide verified dependency visibility.",
        "recommendation": "Define domain service boundaries around coupled components.",
        "upgrade_guidance": None,
        "candidate_considerations": BASE_CONSIDERATIONS,
    },
    {
        "rule_id": "CF-IX-003",
        "domain": "integration_external_dependencies",
        "measure": "confidence",
        "description": "Zero circular dependencies detected in integration graph",
        "detection_condition": "circular_count == 0",
        "weight": 40,
        "impact": "positive",
        "severity": "info",
        "evidence_requirement": "Acyclic integration dependency graph",
        "explanation": "An acyclic dependency structure enables straightforward incremental modernization.",
        "recommendation": "Maintain modular decoupling in target service architecture.",
        "upgrade_guidance": None,
        "candidate_considerations": BASE_CONSIDERATIONS,
    },
    {
        "rule_id": "CF-IX-001",
        "domain": "integration_external_dependencies",
        "measure": "confidence",
        "description": "Unresolved dependency targets reduce integration confidence",
        "detection_condition": "unresolved_dependencies > 0",
        "weight": -25,
        "impact": "negative",
        "severity": "high",
        "evidence_requirement": "unresolved dependency count > 0",
        "explanation": "Unresolved dependencies introduce unknowns regarding external interfaces and runtime targets.",
        "recommendation": "Resolve missing target artifacts or catalog external systems.",
        "upgrade_guidance": None,
        "candidate_considerations": BASE_CONSIDERATIONS,
    },

    # security_controls (sum = 100)
    {
        "rule_id": "CF-SC-002",
        "domain": "security_controls",
        "measure": "confidence",
        "description": "Security access profiles and RACF/ACF2 definitions present",
        "detection_condition": "has_security_components",
        "weight": 60,
        "impact": "positive",
        "severity": "info",
        "evidence_requirement": "Security resource components extracted",
        "explanation": "Extracted security profiles allow mapping legacy permissions to modern IAM roles.",
        "recommendation": "Translate legacy security profiles to target role-based access control (RBAC).",
        "upgrade_guidance": None,
        "candidate_considerations": BASE_CONSIDERATIONS,
    },
    {
        "rule_id": "CF-SC-003",
        "domain": "security_controls",
        "measure": "confidence",
        "description": "Security governance and authorization policies verified",
        "detection_condition": "has_security_components and application.owner",
        "weight": 40,
        "impact": "positive",
        "severity": "info",
        "evidence_requirement": "Security components and application owner documented",
        "explanation": "Documented security ownership ensures compliance review throughout modernization.",
        "recommendation": "Conduct security architecture review with organizational infosec.",
        "upgrade_guidance": None,
        "candidate_considerations": BASE_CONSIDERATIONS,
    },
    {
        "rule_id": "CF-SC-001",
        "domain": "security_controls",
        "measure": "confidence",
        "description": "No security artifacts found reduces security confidence",
        "detection_condition": "not has_security_components",
        "weight": -25,
        "impact": "negative",
        "severity": "medium",
        "evidence_requirement": "Absence of security configuration artifacts",
        "explanation": "Lack of security artifacts leaves data access controls and authorization schemes unverified.",
        "recommendation": "Provide RACF, Top Secret, or ACF2 profile extracts.",
        "upgrade_guidance": None,
        "candidate_considerations": BASE_CONSIDERATIONS,
    },

    # operational_nonfunctional (sum = 100)
    {
        "rule_id": "CF-ON-003",
        "domain": "operational_nonfunctional",
        "measure": "confidence",
        "description": "Operational runbooks and technical environment metadata available",
        "detection_condition": "has_config_artifacts",
        "weight": 60,
        "impact": "positive",
        "severity": "info",
        "evidence_requirement": "Operational configuration or runbook artifacts present",
        "explanation": "Documented SLAs, batch windows, and disaster recovery procedures provide operational certainty.",
        "recommendation": "Establish cloud operational service level objectives (SLOs).",
        "upgrade_guidance": None,
        "candidate_considerations": BASE_CONSIDERATIONS,
    },
    {
        "rule_id": "CF-ON-004",
        "domain": "operational_nonfunctional",
        "measure": "confidence",
        "description": "All portfolio artifacts supported with zero unsupported files",
        "detection_condition": "unsupported_count == 0",
        "weight": 40,
        "impact": "positive",
        "severity": "info",
        "evidence_requirement": "Zero unsupported artifacts in portfolio",
        "explanation": "Complete parser support ensures no dark data or unanalyzed binaries exist in the assessment.",
        "recommendation": "Maintain verified artifact baseline.",
        "upgrade_guidance": None,
        "candidate_considerations": BASE_CONSIDERATIONS,
    },
    {
        "rule_id": "CF-ON-001",
        "domain": "operational_nonfunctional",
        "measure": "confidence",
        "description": "Unsupported artifact types reduce overall assessment confidence",
        "detection_condition": "unsupported_count > 0",
        "weight": -20,
        "impact": "negative",
        "severity": "high",
        "evidence_requirement": "Unsupported artifacts detected in portfolio",
        "explanation": "Unsupported artifacts cannot be statically extracted and lower confidence across the portfolio.",
        "recommendation": "Provide alternative text exports or specialized documentation for unsupported files.",
        "upgrade_guidance": None,
        "candidate_considerations": BASE_CONSIDERATIONS,
    },
]

v2_rules.extend(CONFIDENCE_RULES)

# 3. Readiness rules: Exactly 100 points maximum achievable positive points per domain
READINESS_RULES = [
    # application_business_logic (sum = 100)
    {
        "rule_id": "RD-AB-001",
        "domain": "application_business_logic",
        "measure": "readiness",
        "description": "Application owner documented increases readiness",
        "detection_condition": "application.owner present",
        "weight": 50,
        "impact": "positive",
        "severity": "info",
        "evidence_requirement": "application owner field populated",
        "explanation": "Identified leadership ensures executive sponsorship and architectural decision-making.",
        "recommendation": "Establish modernization steering committee.",
        "upgrade_guidance": None,
        "candidate_considerations": BASE_CONSIDERATIONS,
    },
    {
        "rule_id": "RD-AB-003",
        "domain": "application_business_logic",
        "measure": "readiness",
        "description": "Procedural business logic modularity and boundary readiness",
        "detection_condition": "has_cobol and application.owner",
        "weight": 50,
        "impact": "positive",
        "severity": "info",
        "evidence_requirement": "COBOL code and owner documented",
        "explanation": "Documented logic boundaries allow development teams to begin microservice decomposition.",
        "recommendation": "Define domain-driven design service boundaries.",
        "upgrade_guidance": None,
        "candidate_considerations": BASE_CONSIDERATIONS,
    },
    {
        "rule_id": "RD-AB-002",
        "domain": "application_business_logic",
        "measure": "readiness",
        "description": "Missing application owner reduces readiness",
        "detection_condition": "application.owner not present",
        "weight": -25,
        "impact": "negative",
        "severity": "medium",
        "evidence_requirement": "application owner empty",
        "explanation": "Without an application owner, governance approvals cannot be finalized.",
        "recommendation": "Assign an application owner.",
        "upgrade_guidance": None,
        "candidate_considerations": BASE_CONSIDERATIONS,
    },

    # data_structures (sum = 100)
    {
        "rule_id": "RD-DS-001",
        "domain": "data_structures",
        "measure": "readiness",
        "description": "All referenced copybooks available increases data readiness",
        "detection_condition": "no_unknown_copybooks and has_copybooks",
        "weight": 50,
        "impact": "positive",
        "severity": "info",
        "evidence_requirement": "All copybooks resolved",
        "explanation": "Having all data structures enables automated schema code generation.",
        "recommendation": "Generate target data transfer objects (DTOs).",
        "upgrade_guidance": None,
        "candidate_considerations": BASE_CONSIDERATIONS,
    },
    {
        "rule_id": "RD-DS-003",
        "domain": "data_structures",
        "measure": "readiness",
        "description": "Data record layouts ready for modern serialization",
        "detection_condition": "has_copybooks",
        "weight": 50,
        "impact": "positive",
        "severity": "info",
        "evidence_requirement": "Copybook artifacts parsed",
        "explanation": "Parsed copybooks can be transformed into JSON/Avro/Protobuf contracts.",
        "recommendation": "Define event-driven message schemas.",
        "upgrade_guidance": None,
        "candidate_considerations": BASE_CONSIDERATIONS,
    },
    {
        "rule_id": "RD-DS-002",
        "domain": "data_structures",
        "measure": "readiness",
        "description": "Missing copybooks reduce data structure readiness",
        "detection_condition": "has_unknown_copybooks",
        "weight": -30,
        "impact": "negative",
        "severity": "high",
        "evidence_requirement": "Unresolved copybooks exist",
        "explanation": "Cannot plan data migration with unknown record layouts.",
        "recommendation": "Resolve missing copybooks before sprint planning.",
        "upgrade_guidance": None,
        "candidate_considerations": BASE_CONSIDERATIONS,
    },

    # database_persistence (sum = 100)
    {
        "rule_id": "RD-DB-001",
        "domain": "database_persistence",
        "measure": "readiness",
        "description": "DDL available increases database readiness",
        "detection_condition": "has_ddl",
        "weight": 50,
        "impact": "positive",
        "severity": "info",
        "evidence_requirement": "DDL artifacts present",
        "explanation": "Relational schema is ready for migration to target database engine.",
        "recommendation": "Execute database migration dry-run.",
        "upgrade_guidance": None,
        "candidate_considerations": BASE_CONSIDERATIONS,
    },
    {
        "rule_id": "RD-DB-003",
        "domain": "database_persistence",
        "measure": "readiness",
        "description": "Persistence layer SQL patterns verified for modern ORM mapping",
        "detection_condition": "has_ddl and has_cobol",
        "weight": 50,
        "impact": "positive",
        "severity": "info",
        "evidence_requirement": "DDL and COBOL SQL programs verified",
        "explanation": "SQL statement mapping confirms compatibility with modern JPA/ORM frameworks.",
        "recommendation": "Map SQL cursors to modern database repositories.",
        "upgrade_guidance": None,
        "candidate_considerations": BASE_CONSIDERATIONS,
    },
    {
        "rule_id": "RD-DB-002",
        "domain": "database_persistence",
        "measure": "readiness",
        "description": "Missing DDL reduces database readiness",
        "detection_condition": "has_embedded_sql and not has_ddl",
        "weight": -30,
        "impact": "negative",
        "severity": "high",
        "evidence_requirement": "Embedded SQL without DDL",
        "explanation": "Database migration cannot be designed without table definitions.",
        "recommendation": "Extract DDL from mainframe catalog.",
        "upgrade_guidance": None,
        "candidate_considerations": BASE_CONSIDERATIONS,
    },

    # jobs_batch_orchestration (sum = 100)
    {
        "rule_id": "RD-JB-001",
        "domain": "jobs_batch_orchestration",
        "measure": "readiness",
        "description": "JCL available increases batch readiness",
        "detection_condition": "has_jcl",
        "weight": 50,
        "impact": "positive",
        "severity": "info",
        "evidence_requirement": "JCL artifacts present",
        "explanation": "Batch job stream definitions enable mapping to modern pipeline orchestrators.",
        "recommendation": "Refactor batch steps into scheduled container jobs.",
        "upgrade_guidance": None,
        "candidate_considerations": BASE_CONSIDERATIONS,
    },
    {
        "rule_id": "RD-JB-002",
        "domain": "jobs_batch_orchestration",
        "measure": "readiness",
        "description": "Batch dataset flows ready for modern object/cloud storage",
        "detection_condition": "has_jcl and has_cobol",
        "weight": 50,
        "impact": "positive",
        "severity": "info",
        "evidence_requirement": "JCL and batch programs mapped",
        "explanation": "Sequential dataset transitions can be mapped to S3/Ceph buckets or message queues.",
        "recommendation": "Plan file transfer offloading.",
        "upgrade_guidance": None,
        "candidate_considerations": BASE_CONSIDERATIONS,
    },

    # online_transactions_ui (sum = 100)
    {
        "rule_id": "RD-OL-001",
        "domain": "online_transactions_ui",
        "measure": "readiness",
        "description": "BMS maps available increases online UI readiness",
        "detection_condition": "has_bms",
        "weight": 50,
        "impact": "positive",
        "severity": "info",
        "evidence_requirement": "BMS maps present",
        "explanation": "Screen fields and coordinates provide specification for web front-end refactoring.",
        "recommendation": "Develop responsive modern web UI prototypes.",
        "upgrade_guidance": None,
        "candidate_considerations": BASE_CONSIDERATIONS,
    },
    {
        "rule_id": "RD-OL-002",
        "domain": "online_transactions_ui",
        "measure": "readiness",
        "description": "CICS conversational transactions ready for API endpoint transformation",
        "detection_condition": "has_bms and has_cobol",
        "weight": 50,
        "impact": "positive",
        "severity": "info",
        "evidence_requirement": "BMS maps and CICS COBOL verified",
        "explanation": "Online transaction commands are mapped for conversion to OpenAPI/REST endpoints.",
        "recommendation": "Design OpenAPI specifications from CICS COMMAREA layouts.",
        "upgrade_guidance": None,
        "candidate_considerations": BASE_CONSIDERATIONS,
    },

    # integration_external_dependencies (sum = 100)
    {
        "rule_id": "RD-IX-001",
        "domain": "integration_external_dependencies",
        "measure": "readiness",
        "description": "Dependency graph completed increases integration readiness",
        "detection_condition": "dependency_count > 0 and unresolved_dependencies == 0",
        "weight": 50,
        "impact": "positive",
        "severity": "info",
        "evidence_requirement": "Resolved dependency graph",
        "explanation": "A complete dependency graph enables precise cutover and wave planning.",
        "recommendation": "Plan modernization waves according to dependency tiers.",
        "upgrade_guidance": None,
        "candidate_considerations": BASE_CONSIDERATIONS,
    },
    {
        "rule_id": "RD-IX-003",
        "domain": "integration_external_dependencies",
        "measure": "readiness",
        "description": "Integration architecture boundaries established",
        "detection_condition": "dependency_count > 0",
        "weight": 50,
        "impact": "positive",
        "severity": "info",
        "evidence_requirement": "Integration edges discovered",
        "explanation": "Component linkages establish the boundary for strangler-fig pattern migration.",
        "recommendation": "Implement API gateways to decouple consumers.",
        "upgrade_guidance": None,
        "candidate_considerations": BASE_CONSIDERATIONS,
    },
    {
        "rule_id": "RD-IX-002",
        "domain": "integration_external_dependencies",
        "measure": "readiness",
        "description": "Unresolved dependencies reduce integration readiness",
        "detection_condition": "unresolved_dependencies > 0",
        "weight": -25,
        "impact": "negative",
        "severity": "high",
        "evidence_requirement": "Unresolved dependencies exist",
        "explanation": "Cannot plan wave cutovers when external call targets remain unknown.",
        "recommendation": "Resolve dependency targets before wave planning.",
        "upgrade_guidance": None,
        "candidate_considerations": BASE_CONSIDERATIONS,
    },

    # security_controls (sum = 100)
    {
        "rule_id": "RD-SC-002",
        "domain": "security_controls",
        "measure": "readiness",
        "description": "Security access policies mapped for identity provider integration",
        "detection_condition": "has_security_components",
        "weight": 50,
        "impact": "positive",
        "severity": "info",
        "evidence_requirement": "Security profiles extracted",
        "explanation": "Mainframe access rules are ready for migration to modern OAuth2/OIDC claims.",
        "recommendation": "Configure identity provider role mappings.",
        "upgrade_guidance": None,
        "candidate_considerations": BASE_CONSIDERATIONS,
    },
    {
        "rule_id": "RD-SC-003",
        "domain": "security_controls",
        "measure": "readiness",
        "description": "Security compliance and audit framework ready",
        "detection_condition": "has_security_components and application.owner",
        "weight": 50,
        "impact": "positive",
        "severity": "info",
        "evidence_requirement": "Security components and owner documented",
        "explanation": "Security controls and owner enable signing off on compliance readiness.",
        "recommendation": "Complete security architecture signoff.",
        "upgrade_guidance": None,
        "candidate_considerations": BASE_CONSIDERATIONS,
    },
    {
        "rule_id": "RD-SC-001",
        "domain": "security_controls",
        "measure": "readiness",
        "description": "No security documentation reduces security readiness",
        "detection_condition": "not has_security_components",
        "weight": -20,
        "impact": "negative",
        "severity": "medium",
        "evidence_requirement": "Missing security documentation",
        "explanation": "Security model cannot be validated without documentation or config artifacts.",
        "recommendation": "Document security profiles and authorization model.",
        "upgrade_guidance": None,
        "candidate_considerations": BASE_CONSIDERATIONS,
    },

    # operational_nonfunctional (sum = 100)
    {
        "rule_id": "RD-ON-002",
        "domain": "operational_nonfunctional",
        "measure": "readiness",
        "description": "Business domain documented increases operational readiness",
        "detection_condition": "application.business_domain present",
        "weight": 30,
        "impact": "positive",
        "severity": "info",
        "evidence_requirement": "business domain documented",
        "explanation": "Understanding business context clarifies operational SLAs and priority.",
        "recommendation": "Align business domain roadmap with modernization schedule.",
        "upgrade_guidance": None,
        "candidate_considerations": BASE_CONSIDERATIONS,
    },
    {
        "rule_id": "RD-ON-003",
        "domain": "operational_nonfunctional",
        "measure": "readiness",
        "description": "Technology stack documented increases operational readiness",
        "detection_condition": "application.technology_stack present",
        "weight": 30,
        "impact": "positive",
        "severity": "info",
        "evidence_requirement": "technology stack documented",
        "explanation": "Target modernization pattern depends on accurate legacy stack knowledge.",
        "recommendation": "Validate tech stack versions and compiler options.",
        "upgrade_guidance": None,
        "candidate_considerations": BASE_CONSIDERATIONS,
    },
    {
        "rule_id": "RD-ON-004",
        "domain": "operational_nonfunctional",
        "measure": "readiness",
        "description": "Operational configuration and runtime parameters documented",
        "detection_condition": "has_config_artifacts or application.environment present",
        "weight": 40,
        "impact": "positive",
        "severity": "info",
        "evidence_requirement": "Config artifacts or environment documented",
        "explanation": "Operational environment details enable sizing cloud infrastructure.",
        "recommendation": "Size container cluster nodes and storage volumes.",
        "upgrade_guidance": None,
        "candidate_considerations": BASE_CONSIDERATIONS,
    },
    {
        "rule_id": "RD-ON-001",
        "domain": "operational_nonfunctional",
        "measure": "readiness",
        "description": "Unsupported artifacts reduce operational readiness",
        "detection_condition": "unsupported_count > 0",
        "weight": -20,
        "impact": "negative",
        "severity": "high",
        "evidence_requirement": "Unsupported artifacts present",
        "explanation": "Unknown binaries or unsupported files create unassessed operational risk.",
        "recommendation": "Resolve unsupported files before architectural freeze.",
        "upgrade_guidance": None,
        "candidate_considerations": BASE_CONSIDERATIONS,
    },
]

v2_rules.extend(READINESS_RULES)

def get_evaluation_scope(cond: str) -> str:
    if "component_type" in cond or "detected_properties" in cond or "component." in cond:
        return "component"
    elif "artifact_category" in cond or "artifact." in cond or "artifact " in cond:
        return "artifact"
    elif "dependency." in cond or "dependency " in cond:
        return "dependency"
    else:
        return "application"

for r in v2_rules:
    r["evaluation_scope"] = get_evaluation_scope(r["detection_condition"])

v2 = {
    "ruleset_id": "default_ruleset_v2",
    "version": "2.0.0",
    "effective_date": "2026-11-21",
    "owner": "ReFrameX Architecture Review Board",
    "baselines": {
        "complexity": 0.0,
        "confidence": 0.0,
        "readiness": 0.0,
    },
    "hyperbolic_k": 20.0,
    "coverage_cap": {
        "type": "linear",
        "multiplier": 100.0,
    },
    "changelog": [
        {
            "version": "2.0.0",
            "date": "2026-11-21",
            "author": "Antigravity Architect",
            "summary": "v2 ruleset: zero baseline, rescaled domain points to 100 max achievable, target-neutral recommendations, hyperbolic K configuration",
        }
    ],
    "domain_weights": DOMAIN_WEIGHTS,
    "thresholds": THRESHOLDS,
    "rules": v2_rules,
}

# Validate against schema
with open(SCHEMA_FILE, "r", encoding="utf-8") as f:
    schema = json.load(f)

jsonschema.validate(instance=v2, schema=schema)
print("Schema validation PASSED for ruleset v2!")

# Verify max achievable positive points per domain for confidence & readiness
for d in DOMAINS:
    conf_pos = sum(r["weight"] for r in v2["rules"] if r["domain"] == d and r["measure"] == "confidence" and r["impact"] == "positive")
    read_pos = sum(r["weight"] for r in v2["rules"] if r["domain"] == d and r["measure"] == "readiness" and r["impact"] == "positive")
    print(f"Domain '{d}': Confidence max={conf_pos}, Readiness max={read_pos}")
    assert conf_pos >= 100 and conf_pos <= 120, f"Confidence for {d} is {conf_pos}, expected ~100"
    assert read_pos >= 100 and read_pos <= 120, f"Readiness for {d} is {read_pos}, expected ~100"

# Write out default_ruleset_v2.json
v2_path = RULESET_DIR / "default_ruleset_v2.json"
with open(v2_path, "w", encoding="utf-8") as f:
    json.dump(v2, f, indent=2)

print(f"Successfully generated {v2_path} with {len(v2['rules'])} rules!")
