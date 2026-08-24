import re

with open('backend/app/api/stories.py', 'r') as f:
    lines = f.readlines()

new_lines = []
skip_try = False
for i, line in enumerate(lines):
    if i == 152 and line.strip() == 'try:':
        skip_try = True
        continue
    if skip_try and i > 152 and i <= 210:
        if line.startswith('    '):
            new_lines.append(line[4:])
        else:
            new_lines.append(line)
    else:
        new_lines.append(line)

with open('backend/app/api/stories.py', 'w') as f:
    f.writelines(new_lines)
