"""Seed test data for POC demo."""
import requests
import json

BASE = "http://localhost:8080/api/v1"
PID = "5687e144-d553-4314-a0b7-a23f9f7a4265"

# --- Add resources ---
resources = [
    {"project_ext_id": PID, "name": "张工-机械工程师", "resource_type": "human", "standard_rate": 200, "group_name": "设计组"},
    {"project_ext_id": PID, "name": "李工-电气工程师", "resource_type": "human", "standard_rate": 220, "group_name": "设计组"},
    {"project_ext_id": PID, "name": "王工-控制工程师", "resource_type": "human", "standard_rate": 250, "group_name": "开发组"},
    {"project_ext_id": PID, "name": "赵工-测试工程师", "resource_type": "human", "standard_rate": 180, "group_name": "质量组"},
    {"project_ext_id": PID, "name": "CNC加工中心", "resource_type": "equipment", "standard_rate": 500, "group_name": "设备"},
    {"project_ext_id": PID, "name": "示波器", "resource_type": "equipment", "standard_rate": 100, "group_name": "设备"},
]

print("=== Adding Resources ===")
created_resources = []
for r in resources:
    resp = requests.post(f"{BASE}/resources/{PID}/pool", json=r)
    if resp.status_code in (200, 201):
        data = resp.json()
        created_resources.append(data)
        print(f"  OK: {data['name']} ({data['resource_type']})")
    else:
        print(f"  FAIL: {r['name']} -> {resp.status_code} {resp.text[:100]}")

# --- Add allocations ---
# Get workitem extensions
print("\n=== Getting workitems ===")
gantt_resp = requests.get(f"{BASE}/gantt/{PID}/data").json()
tasks = gantt_resp["tasks"]
task_map = {}
for t in tasks:
    print(f"  Task: {t['id']} -> {t['name']}")
    task_map[t["name"]] = t["id"]

print("\n=== Creating Allocations ===")
alloc_map = [
    ("张工-机械工程师", "2 - 机械结构设计", 1.0),
    ("李工-电气工程师", "3 - 电气设计", 1.0),
    ("王工-控制工程师", "4 - 控制系统开发", 1.0),
    ("赵工-测试工程师", "5 - 集成测试", 1.0),
    ("张工-机械工程师", "1 - 需求分析", 0.5),
    ("李工-电气工程师", "1 - 需求分析", 0.5),
]

# Map resource names to IDs
res_map = {r["name"]: r["id"] for r in created_resources}

for res_name, task_name, units in alloc_map:
    res_id = res_map.get(res_name)
    task_id = task_map.get(task_name)
    if not res_id or not task_id:
        print(f"  SKIP: {res_name} -> {task_name} (not found)")
        continue
    resp = requests.post(f"{BASE}/resources/{PID}/allocations", json={
        "resource_id": res_id,
        "workitem_ext_id": task_id,
        "units": units,
    })
    if resp.status_code in (200, 201):
        print(f"  OK: {res_name} -> {task_name} ({units*100:.0f}%)")
    else:
        print(f"  FAIL: {resp.status_code} {resp.text[:100]}")

# --- Create baseline ---
print("\n=== Creating Baseline ===")
bl_resp = requests.post(f"{BASE}/baseline/{PID}/baselines", json={
    "project_ext_id": PID,
    "name": "初始基线 v1.0",
    "description": "POC 初始计划基线",
})
if bl_resp.status_code in (200, 201):
    bl = bl_resp.json()
    print(f"  OK: {bl['name']} (id={bl['id']}, items={bl['items_count']})")
    
    # --- Calculate EVM ---
    print("\n=== Calculating EVM ===")
    evm_resp = requests.post(f"{BASE}/evm/calculate", json={
        "project_ext_id": PID,
        "baseline_id": bl["id"],
    })
    if evm_resp.status_code == 200:
        evm = evm_resp.json()
        print(f"  BAC: {evm['bac']}")
        print(f"  PV: {evm['pv']}, EV: {evm['ev']}, AC: {evm['ac']}")
        print(f"  SPI: {evm['spi']}, CPI: {evm['cpi']}")
        print(f"  EAC: {evm['eac']}, VAC: {evm['vac']}")
    else:
        print(f"  FAIL: {evm_resp.status_code} {evm_resp.text[:200]}")
else:
    print(f"  FAIL: {bl_resp.status_code} {bl_resp.text[:200]}")

print("\n=== Done ===")
