import os

parts = [
    "head_start.txt",
    "css.txt",
    "head_end_body_start.txt",
    "topbar_sidebar.txt",
    "pages1.txt",
    "pages2.txt",
    "pages3.txt",
    "pages4.txt",
    "pages5.txt",
    "pages6.txt",
    "modals.txt",
    "js_start.txt",
    "js1.txt",
    "js2.txt",
    "js_end.txt"
]

target_file = "/Users/macbook/Desktop/Projects/nm student/index.html"
src_dir = "/Users/macbook/Desktop/Projects/nm student/src/"

with open(target_file, "w", encoding="utf-8") as out:
    for part in parts:
        path = os.path.join(src_dir, part)
        with open(path, "r", encoding="utf-8") as f:
            out.write(f.read() + "\n")

print(f"Successfully generated {target_file}")
