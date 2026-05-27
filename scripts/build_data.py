#!/usr/bin/env python3
"""Convert the source CSV into static JSON assets used by the dashboard."""
import csv, json, os, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC_CSV = Path("/home/user/workspace/timenowdata-federal-program-index-prototype-b.csv")
OUT_DIR = ROOT / "data"
OUT_DIR.mkdir(parents=True, exist_ok=True)

def to_bool(v):
    return str(v).strip().lower() in ("true", "1", "yes", "y", "t")

def split_list(v):
    if not v:
        return []
    return [s.strip() for s in v.replace("|", ";").split(";") if s.strip()]

VALID_MECH = {
  "CASH","IN-KIND","VOUCHER","SUBSIDY","TAX-CREDIT","LOAN","INSURANCE","GUARANTEE",
  "GRANT-FORMULA","GRANT-COMPETITIVE","DIRECT-SERVICE","COMMODITY","GRANT"
}

def mechanism_tokens(v):
    # Split combined mechanism field into clean tokens.
    if not v:
        return []
    head = v.split("(", 1)[0].strip()
    parts = [p.strip().upper() for p in head.replace("/", ",").split(",")]
    out = []
    for p in parts:
        if p in VALID_MECH and p not in out:
            out.append(p)
    return out

records = []
with SRC_CSV.open(newline="", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for row in reader:
        rec = {
            "program_id": int(row["program_id"]),
            "program_name": row["program_name"].strip(),
            "federal_agency": row["federal_agency"].strip(),
            "subagency": (row.get("subagency") or "").strip(),
            "need_categories": split_list(row.get("need_categories", "")),
            "recipient_types": split_list(row.get("recipient_types", "")),
            "benefit_mechanism_raw": (row.get("benefit_mechanism") or "").strip(),
            "benefit_mechanisms": mechanism_tokens(row.get("benefit_mechanism", "")),
            "welfare_stack_relationship": (row.get("welfare_stack_relationship") or "").strip(),
            "state_administered": to_bool(row.get("state_administered", "")),
            "state_supplement_or_waiver_possible": to_bool(row.get("state_supplement_or_waiver_possible", "")),
            "direct_household_value": to_bool(row.get("direct_household_value", "")),
            "links_to_state_database_candidate": to_bool(row.get("links_to_state_database_candidate", "")),
            "priority_batch": (row.get("priority_batch") or "").strip(),
            "rationale": (row.get("rationale") or "").strip(),
            "official_source_url": (row.get("official_source_url") or "").strip(),
            "verification_status": (row.get("verification_status") or "").strip(),
        }
        records.append(rec)

# Sanity checks
assert len(records) == 55, f"Expected 55 records, got {len(records)}"

# Aggregations for KPI sanity (printed only)
agencies = sorted({r["federal_agency"] for r in records})
mechanisms = sorted({m for r in records for m in r["benefit_mechanisms"]})
need_cats = sorted({c for r in records for c in r["need_categories"]})
recipient_types = sorted({c for r in records for c in r["recipient_types"]})

print(f"records: {len(records)}")
print(f"agencies: {len(agencies)} -> {agencies}")
print(f"mechanisms: {len(mechanisms)} -> {mechanisms}")
print(f"need categories: {len(need_cats)}")
print(f"recipient types: {len(recipient_types)}")
print(f"direct household value: {sum(1 for r in records if r['direct_household_value'])}")
print(f"state administered: {sum(1 for r in records if r['state_administered'])}")
print(f"state db candidates: {sum(1 for r in records if r['links_to_state_database_candidate'])}")

(OUT_DIR / "programs.json").write_text(json.dumps(records, indent=2), encoding="utf-8")

# Mirror the original CSV alongside the JSON for convenience/transparency
import shutil
shutil.copyfile(SRC_CSV, OUT_DIR / "programs.csv")

# Build expansion batch metadata
expansion_batches = [
  {"code": "A", "name": "Additional VA Benefits", "estimate": "6–10 programs",
   "focus": "VA programs providing direct financial, health, or housing value to veterans and their dependents",
   "examples": ["VA Healthcare System", "Caregiver Support Program", "Specially Adapted Housing (SAH) Grant", "Service-Disabled Veterans Insurance (S-DVI)", "Dependency and Indemnity Compensation (DIC)"]},
  {"code": "B", "name": "Medicare Sub-Programs & Low-Income Assistance", "estimate": "4–6 programs",
   "focus": "CMS programs providing premium, cost-sharing, or drug cost assistance to low-income Medicare beneficiaries",
   "examples": ["Medicare Savings Programs (QMB/SLMB/QI/QDWI)", "Medicare Part D Low-Income Subsidy (Extra Help)", "D-SNPs", "Medicare Hospice Benefit"]},
  {"code": "C", "name": "HUD Homeless Assistance (Continuum of Care)", "estimate": "3–5 programs",
   "focus": "HUD competitive grant programs funding homeless services providers",
   "examples": ["CoC Permanent Supportive Housing", "Transitional Housing", "Rapid Rehousing", "Safe Havens", "CoC Victim Services set-aside"]},
  {"code": "D", "name": "Federal Higher Education Grants & Work Programs", "estimate": "4–6 programs",
   "focus": "Federal grants and work programs for post-secondary students beyond Pell",
   "examples": ["SEOG", "Federal Work-Study", "TEACH Grant", "Iraq & Afghanistan Service Grant", "HBCU Capital Financing", "TRIO"]},
  {"code": "E", "name": "Behavioral Health, Substance Use & Mental Health Block Grants", "estimate": "3–5 programs",
   "focus": "SAMHSA block grants and targeted grants to states for mental health and SUD services",
   "examples": ["Community Mental Health Services Block Grant (MHBG)", "Substance Abuse Prevention and Treatment Block Grant (SABG)", "Certified Community Behavioral Health Clinics (CCBHCs)"]},
  {"code": "F", "name": "Maternal & Child Health and Disability Services", "estimate": "4–6 programs",
   "focus": "Federal formula grants and programs targeting prenatal, maternal, and child disability services",
   "examples": ["Title V MCH Block Grant", "Early Intervention (IDEA Part C)", "Special Education (IDEA Part B)", "Healthy Start", "Nurse-Family Partnership"]},
  {"code": "G", "name": "Economic Mobility — Savings, Assets & CDFIs", "estimate": "4–6 programs",
   "focus": "Federal programs promoting asset-building, savings, and community financial institution access for low-income households",
   "examples": ["CDFI Fund (BEA, NMTC, Capital Magnet Fund)", "Assets for Independence (IDA)", "State Small Business Credit Initiative (SSBCI)", "USDA Business Development grants"]},
  {"code": "H", "name": "Environmental Justice, Infrastructure & Community Resilience", "estimate": "4–6 programs",
   "focus": "Federal programs distributing direct household or community value through IRA/BIL/IIJA funding streams targeting low-income or disadvantaged communities",
   "examples": ["EPA Environmental Justice Collaborative Problem-Solving grants", "DOE Home Energy Rebates (HOMES/HEAR)", "HUD Resilient Infrastructure Grants", "REAP", "Low-Income Weatherization under IRA"]},
  {"code": "I", "name": "State and Local Pass-Through Indexes", "estimate": "50 state records per major program",
   "focus": "State-specific implementation records for top Tier 1 federal programs (SNAP, Medicaid, TANF, CCDF, LIHEAP, UI)",
   "examples": ["Nevada SNAP income limits & EBT schedule", "Nevada Medicaid / Nevada Check Up", "TANF/Nevada Families benefit schedule", "California LIHEAP vs. Nevada LIHEAP"]},
  {"code": "J", "name": "Federal Administrative & System-Level Programs", "estimate": "5–8 programs",
   "focus": "Federal programs that transfer value primarily to institutions, public administrative systems, or state governments",
   "examples": ["Title XIX Medicaid Administration Matching", "MMIS funding", "SSA systems grants to states", "Election Security (HAVA)", "Public Health Emergency Preparedness (PHEP)", "Title XX SSBG transfers", "Emergency Management Performance Grants (EMPG)"]},
]
(OUT_DIR / "expansion_batches.json").write_text(json.dumps(expansion_batches, indent=2), encoding="utf-8")

# Build initial-batch summary (Batches 1-16)
initial_batches = [
  {"name": "Batch 1 — Core Income & Nutrition", "programs": 8, "focus": "Cash assistance, food, tax credits"},
  {"name": "Batch 2 — Health Coverage", "programs": 4, "focus": "Health insurance, subsidies"},
  {"name": "Batch 3 — Housing Assistance", "programs": 8, "focus": "Rental, ownership, homelessness"},
  {"name": "Batch 4 — Veterans Benefits", "programs": 3, "focus": "Disability, income, education"},
  {"name": "Batch 5 — Education & Student Aid", "programs": 3, "focus": "Grants, loans, K-12"},
  {"name": "Batch 6 — Energy & Utilities", "programs": 3, "focus": "LIHEAP, weatherization, telecom"},
  {"name": "Batch 7 — Nutrition (Child & Community)", "programs": 6, "focus": "School meals, child care, seniors, tribal"},
  {"name": "Batch 8 — Workers & Employment", "programs": 3, "focus": "UI, workforce, apprenticeship"},
  {"name": "Batch 9 — Agriculture & Rural", "programs": 3, "focus": "Farm, crop insurance, rural housing"},
  {"name": "Batch 10 — Small Business", "programs": 2, "focus": "Business loans, guarantees"},
  {"name": "Batch 11 — Disability, Social Services, Child Welfare", "programs": 2, "focus": "Foster care, block grants"},
  {"name": "Batch 12 — Disaster Assistance", "programs": 2, "focus": "FEMA, flood insurance"},
  {"name": "Batch 13 — FHA Mortgage", "programs": 1, "focus": "Homeownership insurance"},
  {"name": "Batch 14 — Tribal & Indigenous", "programs": 2, "focus": "IHS, BIA"},
  {"name": "Batch 15 — National Service", "programs": 1, "focus": "AmeriCorps"},
  {"name": "Batch 16 — Supplemental & Adjacent", "programs": 5, "focus": "Tax credits, conservation, VA loans, HIV"},
]
(OUT_DIR / "initial_batches.json").write_text(json.dumps(initial_batches, indent=2), encoding="utf-8")

print(f"Wrote {OUT_DIR/'programs.json'}, programs.csv, expansion_batches.json, initial_batches.json")
