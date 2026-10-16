"""Encode equipment originals as full-resolution WebP; retain every source PNG."""
from pathlib import Path
import json
from PIL import Image

root = Path(__file__).resolve().parents[1]
records = []
for category in ("weapons", "relics"):
    for source in sorted((root / "apps/client/public/assets" / category).glob("*.png")):
        target = source.with_suffix(".webp")
        with Image.open(source) as image:
            image.save(target, "WEBP", quality=90, method=6)
            size = image.size
        with Image.open(target) as encoded:
            assert encoded.size == size
        records.append({"key": f"{category}:{source.stem}", "width": size[0], "height": size[1], "originalBytes": source.stat().st_size, "optimizedBytes": target.stat().st_size})
report = {"encoding": "WebP quality 90 method 6, original dimensions and PNG files retained", "originalBytes": sum(r["originalBytes"] for r in records), "optimizedBytes": sum(r["optimizedBytes"] for r in records), "files": records}
selected_keys = ["weapons:w_cam_ve_kich", "weapons:w_han_mon_kiem", "weapons:w_vong_quoc_cam", "relics:r_vong_nguyet_kinh", "relics:r_ho_tam_chau"]
selected = [record for record in records if record["key"] in selected_keys]
report["selectedCombatExample"] = {"description": "Example selected three-hero equipment loadout; other gear is excluded by deck/battle selection", "keys": selected_keys, "originalBytes": sum(record["originalBytes"] for record in selected), "optimizedBytes": sum(record["optimizedBytes"] for record in selected)}
(root / "docs/reviews/equipment-optimization.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print(json.dumps({k: v for k, v in report.items() if k != "files"}))
