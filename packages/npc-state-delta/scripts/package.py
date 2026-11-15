"""Produce and verify a deterministic runtime-only Delta installable package."""
from pathlib import Path
import hashlib
import json
import re
import subprocess
import zipfile

root = Path(__file__).resolve().parent.parent
manifest = json.loads((root / 'manifest.json').read_text())
runtime_config = json.loads((root / 'runtime-modules.json').read_text())
runtime_files = [str(item['path']) for item in runtime_config.get('modules', [])]
root_js = sorted(p.name for p in root.glob('*.js'))
top_level_runtime = [name for name in runtime_files if '/' not in name]
assert sorted(top_level_runtime) == root_js, 'runtime-modules.json must declare every and only top-level runtime JS module'
assert runtime_config.get('applicationVersion') == manifest['version'], 'runtime inventory version differs from manifest'
assert runtime_config.get('entrypoint') == manifest['js'], 'runtime inventory entrypoint differs from manifest'
src_module = re.compile(r'^src/(?:[A-Za-z0-9_.-]+/)*[A-Za-z0-9_.-]+\.js$')
assert all(name.endswith('.js') and ('/' not in name or (src_module.match(name) and '..' not in name.split('/'))) for name in runtime_files), 'runtime inventory contains a JS path outside the top level and src/'
assert all((root / name).is_file() for name in runtime_files), 'runtime inventory declares a missing module'

# src/storysuite-v2.js is the optional Story Suite v2 adapter, imported by index.js at runtime;
# src/npc-meters.js, src/npc-meters-screen.js and src/npc-meters-presets.js are its npc slice, NPC card and meter presets;
# src/adapter/queries.js, cast-ui.js, timeline.js, connect.js and editor.js are the parts of the adapter's factory (moved out of src/storysuite-v2.js);
# src/adapter/queries-dossier.js and -director.js are the dossier/portrait and Story Director/pack parts of src/adapter/queries.js;
# src/adapter/cast-ui/ holds the cohesive parts of cast-ui.js (drawer, section, dossier list, cast render, page API, views, presets and turn);
# appearance-*-parts/ hold the parts of appearance-fill.js, appearance-model.js, appearance-physical.js and appearance-text.js (each a facade re-exporting them);
# src/npc-meters-config.js, -secrets.js, -slice.js and -schema.js are the pure top-level parts of src/npc-meters.js (moved out of it);
# src/npc-meters-commands.js, -queries.js and -prompt.js are the change/command, query and prompt parts of src/npc-meters.js;
# src/npc-notes-*.js are the dossier notes (lies, knows, tastes, drives, look, ties) and their kinds file, parts of src/npc-meters.js;
# src/social-check.js is the social check rules (npc.socialModifier);
# src/public-paths.js is the definition of Delta's public paths (npc.<name>.<meter>) for Story Block's sdk.registerPublicPaths;
# src/storysuite-participant/ is the Story Block restore participant (checkpoint, prepare, activate, npc.identity).
support_files = ['style.css', 'suite.css', 'style-editor.css', 'style-cast.css', 'style-portrait.css', 'style-settings-panel.css', 'manifest.json', 'runtime-modules.json', 'LICENSE', 'README.md', 'src/storysuite-v2.js', 'src/adapter/queries.js', 'src/adapter/queries-dossier.js', 'src/adapter/queries-director.js', 'src/adapter/cast-ui.js', 'src/adapter/timeline.js', 'src/adapter/connect.js', 'src/adapter/editor.js', 'src/npc-meters.js', 'src/npc-meters-commands.js', 'src/npc-meters-queries.js', 'src/npc-meters-prompt.js', 'src/npc-meters-pacing.js', 'src/npc-meters-screen.js', 'src/npc-meters-presets.js', 'src/npc-meters-config.js', 'src/npc-meters-secrets.js', 'src/npc-meters-slice.js', 'src/npc-meters-schema.js', 'src/npc-notes-drives.js', 'src/npc-notes-kinds.js', 'src/npc-notes-knows.js', 'src/npc-notes-lies.js', 'src/npc-notes-look.js', 'src/npc-notes-tastes.js', 'src/npc-notes-ties.js', 'src/social-check.js', 'src/public-paths.js', 'src/storysuite-participant/checkpoint.js', 'src/storysuite-participant/hash.js', 'src/storysuite-participant/identity.js', 'src/storysuite-participant/history-replay.js', 'src/storysuite-participant/history-replay-controller.js', 'src/storysuite-participant/index.js', 'src/storysuite-participant/participant.js', 'src/storysuite-participant/timeline.js', 'src/storysuite-participant/vault.js', 'src/storysuite-participant/vault-sweep.js', 'src/storysuite-participant/storage-row.js', 'src/adapter/cast-ui/cast-render.js', 'src/adapter/cast-ui/cast-views.js', 'src/adapter/cast-ui/dom.js', 'src/adapter/cast-ui/dossier-list.js', 'src/adapter/cast-ui/drawer.js', 'src/adapter/cast-ui/page-api.js', 'src/adapter/cast-ui/presets.js', 'src/adapter/cast-ui/section.js', 'src/adapter/cast-ui/turn.js', 'src/adapter/cast-ui/watchers.js', 'src/storysuite-participant/participant/handlers.js', 'src/storysuite-participant/participant/publication.js', 'src/storysuite-participant/participant/session-ops.js', 'src/storysuite-participant/participant/support.js', 'appearance-fill-parts/age.js', 'appearance-fill-parts/append.js', 'appearance-fill-parts/features.js', 'appearance-fill-parts/gate.js', 'appearance-fill-parts/line.js', 'appearance-fill-parts/shared-basics.js', 'appearance-fill-parts/split-look.js', 'appearance-fill-parts/wanted.js', 'appearance-model-parts/bridge.js', 'appearance-model-parts/canonical.js', 'appearance-model-parts/forms.js', 'appearance-model-parts/resolve.js', 'appearance-model-parts/shared-cast-words.js', 'appearance-physical-parts/guess.js', 'appearance-physical-parts/identity.js', 'appearance-physical-parts/pieces.js', 'appearance-physical-parts/preserve.js', 'appearance-physical-parts/refine-compare.js', 'appearance-physical-parts/refine-tokens.js', 'appearance-physical-parts/segments.js', 'appearance-physical-parts/shared-pieces.js', 'appearance-physical-parts/swap-axes.js', 'appearance-physical-parts/trait-patterns.js', 'appearance-physical-parts/trait-pieces.js', 'appearance-physical-parts/trait-swaps.js', 'appearance-text-parts/basics.js', 'appearance-text-parts/clauses.js', 'appearance-text-parts/combine.js', 'appearance-text-parts/forms.js']
support_files = ['style.css', 'suite.css', 'style-editor.css', 'style-cast.css', 'style-portrait.css', 'style-settings-panel.css', 'manifest.json', 'runtime-modules.json', 'LICENSE', 'README.md', 'src/storysuite-v2.js', 'src/adapter/queries.js', 'src/adapter/queries-dossier.js', 'src/adapter/queries-director.js', 'src/adapter/cast-ui.js', 'src/adapter/timeline.js', 'src/adapter/connect.js', 'src/adapter/editor.js', 'src/npc-meters.js', 'src/npc-meters-commands.js', 'src/npc-meters-queries.js', 'src/npc-meters-prompt.js', 'src/npc-meters-pacing.js', 'src/npc-meters-screen.js', 'src/npc-meters-presets.js', 'src/npc-meters-config.js', 'src/npc-meters-secrets.js', 'src/npc-meters-slice.js', 'src/npc-meters-schema.js', 'src/npc-notes-drives.js', 'src/npc-notes-kinds.js', 'src/npc-notes-knows.js', 'src/npc-notes-lies.js', 'src/npc-notes-look.js', 'src/npc-notes-tastes.js', 'src/npc-notes-ties.js', 'src/social-check.js', 'src/public-paths.js', 'src/storysuite-participant/checkpoint.js', 'src/storysuite-participant/hash.js', 'src/storysuite-participant/identity.js', 'src/storysuite-participant/history-replay.js', 'src/storysuite-participant/history-replay-controller.js', 'src/storysuite-participant/index.js', 'src/storysuite-participant/participant.js', 'src/storysuite-participant/timeline.js', 'src/storysuite-participant/vault.js', 'src/storysuite-participant/vault-sweep.js', 'src/storysuite-participant/storage-row.js', 'src/adapter/cast-ui/cast-render.js', 'src/adapter/cast-ui/cast-views.js', 'src/adapter/cast-ui/dom.js', 'src/adapter/cast-ui/dossier-list.js', 'src/adapter/cast-ui/drawer.js', 'src/adapter/cast-ui/page-api.js', 'src/adapter/cast-ui/presets.js', 'src/adapter/cast-ui/section.js', 'src/adapter/cast-ui/turn.js', 'src/adapter/cast-ui/watchers.js', 'src/storysuite-participant/participant/handlers.js', 'src/storysuite-participant/participant/publication.js', 'src/storysuite-participant/participant/session-ops.js', 'src/storysuite-participant/participant/support.js', 'birthday-parts/date.js', 'birthday-parts/derive.js', 'birthday-parts/normalize.js', 'birthday-parts/prompt.js', 'birthday-parts/scan-input.js', 'birthday-parts/shared-compare.js', 'birthday-parts/shared-config.js', 'birthday-parts/update.js', 'branch-checkpoints-parts/family.js', 'branch-checkpoints-parts/normalize.js', 'branch-checkpoints-parts/prune.js', 'branch-checkpoints-parts/record.js', 'branch-checkpoints-parts/shared-bytes.js', 'branch-constants-parts/journal.js', 'branch-constants-parts/snapshot.js']
files = runtime_files + support_files
src_js = sorted(p.relative_to(root).as_posix() for p in (root / 'src').rglob('*.js'))
assert all(name in files for name in src_js), 'every src/ module must be packaged'
# A src/ module may be declared in the inventory and listed as a support file too; it ships once.
files = list(dict.fromkeys(files))
out = root / 'dist'
out.mkdir(exist_ok=True)
archive = out / f"npc_state_delta-{manifest['version']}.zip"
with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as bundle:
    for name in files:
        info = zipfile.ZipInfo(f'npc_state_delta/{name}', date_time=(2026, 9, 11, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        bundle.writestr(info, (root / name).read_bytes(), compresslevel=9)
with zipfile.ZipFile(archive) as bundle:
    assert bundle.testzip() is None, 'archive CRC failure'
    assert sorted(bundle.namelist()) == sorted(f'npc_state_delta/{name}' for name in files)
    for name in files:
        data = bundle.read(f'npc_state_delta/{name}')
        assert data == (root / name).read_bytes(), f'packaged bytes differ: {name}'
        if name.endswith('.js'):
            subprocess.run(['node', '--input-type=module', '--check'], input=data, check=True, capture_output=True)
digest = hashlib.sha256(archive.read_bytes()).hexdigest()
archive.with_suffix('.zip.sha256').write_text(f'{digest}  {archive.name}\n')
print(json.dumps({'archive': archive.name, 'runtimeFiles': len(runtime_files), 'bytes': archive.stat().st_size, 'sha256': digest, 'contentsAndSyntaxVerified': True, 'runtimeInventoryVerified': True}))
