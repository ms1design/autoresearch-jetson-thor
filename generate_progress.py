
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import sys

results_file = "/home/narandill/autoresearch-jetson-thor/results.tsv"
progress_png = "/home/narandill/autoresearch-jetson-thor/progress.png"

df = pd.read_csv(results_file, sep="\t")
df["val_bpb"] = pd.to_numeric(df["val_bpb"], errors="coerce")
df["memory_gb"] = pd.to_numeric(df["memory_gb"], errors="coerce")
df["status"] = df["status"].str.strip().str.upper()

# Filter out crashes for plotting
valid = df[df["status"] != "CRASH"].copy()
valid = valid.reset_index(drop=True)

if len(valid) == 0:
    sys.exit(0)

baseline_bpb = valid.loc[0, "val_bpb"]

# Only plot points at or below baseline + margin
margin_val = 0.0005
below = valid[valid["val_bpb"] <= baseline_bpb + margin_val]

fig, ax = plt.subplots(figsize=(16, 8))

# Plot discarded as faint background dots
disc = below[below["status"] == "DISCARD"]
if len(disc) > 0:
    ax.scatter(disc.index, disc["val_bpb"], c="#cccccc", s=12, alpha=0.5, zorder=2, label="Discarded")

# Plot kept experiments as prominent green dots
kept_v = below[below["status"] == "KEEP"]
if len(kept_v) > 0:
    ax.scatter(kept_v.index, kept_v["val_bpb"], c="#2ecc71", s=50, zorder=4, label="Kept", edgecolors="black", linewidths=0.5)

# Running minimum step line
kept_mask = valid["status"] == "KEEP"
kept_idx = valid.index[kept_mask]
kept_bpb = valid.loc[kept_mask, "val_bpb"]
running_min = kept_bpb.cummin()
ax.step(kept_idx, running_min, where="post", color="#27ae60", linewidth=2, alpha=0.7, zorder=3, label="Running best")

# Label each kept experiment
for idx, bpb in zip(kept_idx, kept_bpb):
    desc = str(valid.loc[idx, "description"]).strip()
    if len(desc) > 45:
        desc = desc[:42] + "..."
    ax.annotate(desc, (idx, bpb), textcoords="offset points", xytext=(6, 6), fontsize=8.0, color="#1a7a3a", alpha=0.9, rotation=30, ha="left", va="bottom")

n_total = len(df)
n_kept = len(df[df["status"] == "KEEP"])
ax.set_xlabel("Experiment #", fontsize=12)
ax.set_ylabel("Validation BPB (lower is better)", fontsize=12)
ax.set_title(f"Autoresearch Progress: {n_total} Experiments, {n_kept} Kept Improvements", fontsize=14)
ax.legend(loc="upper right", fontsize=9)
ax.grid(True, alpha=0.2)

# Y-axis range
if len(kept_v) > 0:
    best = kept_v["val_bpb"].min()
else:
    best = baseline_bpb
margin = (baseline_bpb - best) * 0.15 if baseline_bpb > best else 0.01
ax.set_ylim(max(0, best - margin), baseline_bpb + margin)

plt.tight_layout()
plt.savefig(progress_png, dpi=150, bbox_inches="tight")
print(f"Saved progress.png to {progress_png}")
