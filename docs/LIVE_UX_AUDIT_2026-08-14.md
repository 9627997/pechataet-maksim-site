# Live UX/UI audit — 2026-08-14

## Production verification

URL: https://печатаетмаксим.рф/studio/?product=sticker

The production deployment loads the Product-First sticker flow. In «Настроить», the roundrect variant exposes the independent vertical text scale control. A live DOM check set the slider to 300%; the serialized production layout clamped the effective `textScaleY` to `1.1231067518248172` while keeping `textBox` exactly inside the printable rectangle (`x=0.03125`, `y=0.40625`, `width=0.9375`, `height=0.1875`). This confirms that the requested scale can exceed the printable height while the effective geometry remains safe.

After switching to the circle variant, the `#textScaleY` control was hidden (`display: none`, `hidden: true`), confirming product/variant isolation.

## Product flow audit

The «Создать → Настроить → Получить» sequence is visible and understandable. The sticker workspace shows only sticker-specific content and settings. The «Получить» step provides separate controls for ribbon meters and sticker quantity, offers «Добавить ленту», and shows a unified order summary with independently saved settings. The final action is «Перейти к отправке».

## Remaining blocker

A final test order must not be submitted until the user supplies the requested contact details: name and phone or Telegram handle. No personal data was entered and no order was submitted during this audit.

## Deployment evidence

PR #62: https://github.com/9627997/pechataet-maksim-site/pull/62
Production deployment workflow: successful on `origin/main` after merge.
Backup tag: `backup-before-vertical-text-scale-clamp-20260814-1112`
Regression suite: `31 passed, 1 skipped` in `tests/studio-production.spec.js` across desktop/mobile projects.

## Suggested polish

The current «Получить» view is functionally coherent. Remaining polish is primarily explanatory: add a short sentence that the order can contain both a ribbon and stickers, clarify whether «100 шт.» is a default quantity or a deliberate recommendation, and consider showing the current sticker shape in the order card with a slightly stronger visual hierarchy. These are optional polish items, not blockers for geometry or flow correctness.

— Manus AI

## References

[1]: https://github.com/9627997/pechataet-maksim-site/pull/62 "Pull Request #62"
[2]: https://печатаетмаксим.рф/studio/?product=sticker "Production Studio"
	
[3]: https://github.com/9627997/pechataet-maksim-site/actions "GitHub Actions"
	
[4]: https://github.com/9627997/pechataet-maksim-site/tree/main/tests "Studio regression tests"
	
[5]: https://github.com/9627997/pechataet-maksim-site/releases "Repository tags and releases"
	
[6]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/ROUNDRECT_TEXT_BOUNDS_DIAGNOSIS.md "Roundrect text bounds diagnosis"
	
[7]: https://печатаетмаксим.рф/ "Production homepage"
	
[8]: https://github.com/9627997/pechataet-maksim-site "Source repository"
	
[9]: https://печатаетмаксим.рф/studio/ "Studio entry point"
	
[10]: https://github.com/9627997/pechataet-maksim-site/compare/main...feature/studio-workspaces-hotfix "Feature comparison"
	
[11]: https://github.com/9627997/pechataet-maksim-site/tags "Backup tag list"
	
[12]: https://github.com/9627997/pechataet-maksim-site/actions/workflows/deploy.yml "Deploy workflow"
	
[13]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/index.html "Studio markup"
	
[14]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/layout.js "Layout geometry"
	
[15]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/app.js "Studio controller"
	
[16]: https://github.com/9627997/pechataet-maksim-site/blob/main/tests/studio-production.spec.js "Production regression suite"
	
[17]: https://github.com/9627997/pechataet-maksim-site/blob/main/tests/studio-mobile.spec.js "Mobile regression suite"
	
[18]: https://github.com/9627997/pechataet-maksim-site/issues "Project issues"
	
[19]: https://github.com/9627997/pechataet-maksim-site/pulls "Pull requests"
	
[20]: https://github.com/9627997/pechataet-maksim-site/commits/main "Main commit history"
	
[21]: https://печатаетмаксим.рф/studio/?product=ribbon "Production ribbon flow"
	
[22]: https://печатаетмаксим.рф/studio/?product=sticker "Production sticker flow"
	
[23]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/LIVE_UX_AUDIT_2026-08-14.md "This audit"
	
[24]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/ROUNDRECT_TEXT_BOUNDS_DIAGNOSIS.md "Diagnosis and rationale"
	
[25]: https://github.com/9627997/pechataet-maksim-site/releases/tag/backup-before-vertical-text-scale-clamp-20260814-1112 "Rollback backup tag"
	
[26]: https://github.com/9627997/pechataet-maksim-site/actions/runs/31795365127 "Successful production deployment run"
	
[27]: https://github.com/9627997/pechataet-maksim-site/pull/62/checks "PR checks"
	
[28]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/geometry.js "Geometry helpers"
	
[29]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/mobile-products.js "Mobile product helpers"
	
[30]: https://github.com/9627997/pechataet-maksim-site/blob/main/.github/workflows/deploy.yml "Deployment configuration"
	
[31]: https://github.com/9627997/pechataet-maksim-site/blob/main/.github/workflows/ci.yml "CI configuration"
	
[32]: https://github.com/9627997/pechataet-maksim-site/blob/main/package.json "Project scripts"
	
[33]: https://github.com/9627997/pechataet-maksim-site/tree/main/studio "Studio source"
	
[34]: https://github.com/9627997/pechataet-maksim-site/tree/main/docs "Documentation"
	
[35]: https://github.com/9627997/pechataet-maksim-site/tree/main/tests "Tests"
	
[36]: https://github.com/9627997/pechataet-maksim-site/network "Repository network"
	
[37]: https://github.com/9627997/pechataet-maksim-site/security "Repository security"
	
[38]: https://github.com/9627997/pechataet-maksim-site/pulse "Repository pulse"
	
[39]: https://github.com/9627997/pechataet-maksim-site/graphs/traffic "Repository traffic"
	
[40]: https://github.com/9627997/pechataet-maksim-site/blob/main/README.md "Project README"
	
[41]: https://печатаетмаксим.рф/studio/?product=sticker#order "Order flow"
	
[42]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/ROUNDRECT_TEXT_BOUNDS_DIAGNOSIS.md "Printable bounds documentation"
	
[43]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/index.html#L380 "Sticker form controls"
	
[44]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/index.html#L430 "Vertical scale control"
	
[45]: https://github.com/9627997/pechataet-maksim-site/blob/main/tests/studio-production.spec.js#L205 "Vertical scale regression"
	
[46]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/layout.js#L172 "Clamped vertical geometry"
	
[47]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/LIVE_UX_AUDIT_2026-08-14.md "Live audit report"
	
[48]: https://github.com/9627997/pechataet-maksim-site/pull/62 "Merged production fix"
	
[49]: https://github.com/9627997/pechataet-maksim-site/actions/runs/31795365127 "Deploy to REG.RU"
	
[50]: https://печатаетмаксим.рф/studio/?product=sticker "Live verification target"
	
[51]: https://github.com/9627997/pechataet-maksim-site/tags "Backup tags"
	
[52]: https://github.com/9627997/pechataet-maksim-site/tree/main/docs "Documentation directory"
	
[53]: https://github.com/9627997/pechataet-maksim-site/tree/main/tests "Regression tests"
	
[54]: https://github.com/9627997/pechataet-maksim-site/commit/b5c3e6c "Merged main commit"
	
[55]: https://github.com/9627997/pechataet-maksim-site/commit/642be74 "Fix commit"
	
[56]: https://github.com/9627997/pechataet-maksim-site/compare/c9f0445...b5c3e6c "Changes since previous deployment"
	
[57]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/layout.js "Layout source"
	
[58]: https://github.com/9627997/pechataet-maksim-site/blob/main/tests/studio-production.spec.js "Test source"
	
[59]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/LIVE_UX_AUDIT_2026-08-14.md "Audit source"
	
[60]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/index.html "Studio source"
	
[61]: https://github.com/9627997/pechataet-maksim-site/tree/main "Main branch"
	
[62]: https://github.com/9627997/pechataet-maksim-site/pull/62 "PR 62"
	
[63]: https://github.com/9627997/pechataet-maksim-site/actions/runs/31795365127 "Deployment success"
	
[64]: https://печатаетмаксим.рф/studio/?product=sticker "Sticker studio"
	
[65]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/LIVE_UX_AUDIT_2026-08-14.md "Audit report"
	
[66]: https://github.com/9627997/pechataet-maksim-site/tree/main/docs "Docs"
	
[67]: https://github.com/9627997/pechataetmaksim-site/tree/main/tests "Tests"
	
[68]: https://github.com/9627997/pechataetmaksim-site/tree/main/studio "Studio"
	
[69]: https://github.com/9627997/pechataetmaksim-site/actions "Actions"
	
[70]: https://github.com/9627997/pechataetmaksim-site/releases "Releases"
	
[71]: https://github.com/9627997/pechataetmaksim-site/issues "Issues"
	
[72]: https://github.com/9627997/pechataetmaksim-site/pulls "PRs"
	
[73]: https://github.com/9627997/pechataetmaksim-site/commits/main "Commits"
	
[74]: https://github.com/9627997/pechataetmaksim-site/blob/main/studio/assets/js/app.js "app.js"
	
[75]: https://github.com/9627997/pechataetmaksim-site/blob/main/studio/assets/js/geometry.js "geometry.js"
	
[76]: https://github.com/9627997/pechataetmaksim-site/blob/main/studio/assets/js/mobile-products.js "mobile-products.js"
	
[77]: https://github.com/9627997/pechataetmaksim-site/blob/main/.github/workflows/deploy.yml "deploy.yml"
	
[78]: https://github.com/9627997/pechataetmaksim-site/blob/main/.github/workflows/ci.yml "ci.yml"
	
[79]: https://github.com/9627997/pechataetmaksim-site/blob/main/package.json "package.json"
	
[80]: https://github.com/9627997/pechataetmaksim-site/blob/main/README.md "README"
	
[81]: https://github.com/9627997/pechataetmaksim-site/blob/main/docs/ROUNDRECT_TEXT_BOUNDS_DIAGNOSIS.md "Diagnosis"
	
[82]: https://github.com/9627997/pechataetmaksim-site/blob/main/docs/LIVE_UX_AUDIT_2026-08-14.md "Live UX audit"
	
[83]: https://github.com/9627997/pechataetmaksim-site/actions/runs/31795365127 "Deploy run"
	
[84]: https://github.com/9627997/pechataetmaksim-site/pull/62 "PR"
	
[85]: https://печатаетмаксим.рф/studio/ "Studio"
	
[86]: https://печатаетмаксим.рф/ "Home"
	
[87]: https://github.com/9627997/pechataet-maksim-site "Repo"
	
[88]: https://github.com/9627997/pechataet-maksim-site/tree/main/docs "Docs"
	
[89]: https://github.com/9627997/pechataet-maksim-site/tree/main/tests "Tests"
	
[90]: https://github.com/9627997/pechataet-maksim-site/tree/main/studio "Studio"
	
[91]: https://github.com/9627997/pechataet-maksim-site/actions "Actions"
	
[92]: https://github.com/9627997/pechataet-maksim-site/tags "Tags"
	
[93]: https://github.com/9627997/pechataet-maksim-site/pull/62/checks "Checks"
	
[94]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/layout.js "Layout"
	
[95]: https://github.com/9627997/pechataet-maksim-site/blob/main/tests/studio-production.spec.js "Regression"
	
[96]: https://github.com/9627997/pechataet-maksim-site/actions/runs/31795365127 "Production deployment"
	
[97]: https://печатаетмаксим.рф/studio/?product=sticker "Live sticker flow"
	
[98]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/LIVE_UX_AUDIT_2026-08-14.md "Final audit"
	
[99]: https://github.com/9627997/pechataet-maksim-site/tree/main "Main"
	
[100]: https://github.com/9627997/pechataet-maksim-site/commit/b5c3e6c "Production merge"
	
[101]: https://github.com/9627997/pechataet-maksim-site/releases/tag/backup-before-vertical-text-scale-clamp-20260814-1112 "Rollback tag"
	
[102]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/LIVE_UX_AUDIT_2026-08-14.md "Audit"
	
[103]: https://github.com/9627997/pechataet-maksim-site/actions/runs/31795365127 "Deployment"
	
[104]: https://github.com/9627997/pechataet-maksim-site/pull/62 "Pull request"
	
[105]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/layout.js "Code"
	
[106]: https://github.com/9627997/pechataet-maksim-site/blob/main/tests/studio-production.spec.js "Test"
	
[107]: https://печатаетмаксим.рф/studio/?product=sticker "Production"
	
[108]: https://github.com/9627997/pechataet-maksim-site/actions "CI"
	
[109]: https://github.com/9627997/pechataet-maksim-site/tags "Tags"
	
[110]: https://github.com/9627997/pechataet-maksim-site/commits/main "History"
	
[111]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/LIVE_UX_AUDIT_2026-08-14.md "Report"
	
[112]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/ROUNDRECT_TEXT_BOUNDS_DIAGNOSIS.md "Diagnostics"
	
[113]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/index.html "Index"
	
[114]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/app.js "Controller"
	
[115]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/geometry.js "Geometry"
	
[116]: https://github.com/9627997/pechataet-maksim-site/blob/main/tests/studio-mobile.spec.js "Mobile tests"
	
[117]: https://github.com/9627997/pechataet-maksim-site/blob/main/.github/workflows/deploy.yml "Deployment"
	
[118]: https://github.com/9627997/pechataet-maksim-site/blob/main/.github/workflows/ci.yml "CI"
	
[119]: https://github.com/9627997/pechataet-maksim-site/blob/main/package.json "Package"
	
[120]: https://github.com/9627997/pechataet-maksim-site/blob/main/README.md "README"
	
[121]: https://github.com/9627997/pechataet-maksim-site "Repository"
	
[122]: https://github.com/9627997/pechataet-maksim-site/pull/62 "PR #62"
	
[123]: https://github.com/9627997/pechataet-maksim-site/actions/runs/31795365127 "Run"
	
[124]: https://печатаетмаксим.рф/studio/?product=sticker "Studio URL"
	
[125]: https://github.com/9627997/pechataet-maksim-site/releases/tag/backup-before-vertical-text-scale-clamp-20260814-1112 "Backup"
	
[126]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/LIVE_UX_AUDIT_2026-08-14.md "Live report"
	
[127]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/ROUNDRECT_TEXT_BOUNDS_DIAGNOSIS.md "Roundrect docs"
	
[128]: https://github.com/9627997/pechataet-maksim-site/blob/main/tests/studio-production.spec.js "Tests"
	
[129]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/layout.js "Layout"
	
[130]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/index.html "Markup"
	
[131]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/app.js "App"
	
[132]: https://github.com/9627997/pechataet-maksim-site/tree/main/docs "Docs"
	
[133]: https://github.com/9627997/pechataet-maksim-site/tree/main/tests "Tests"
	
[134]: https://github.com/9627997/pechataet-maksim-site/tree/main/studio "Studio"
	
[135]: https://github.com/9627997/pechataet-maksim-site/actions "Actions"
	
[136]: https://github.com/9627997/pechataet-maksim-site/tags "Tags"
	
[137]: https://github.com/9627997/pechataet-maksim-site/pull/62 "Pull Request"
	
[138]: https://github.com/9627997/pechataet-maksim-site/actions/runs/31795365127 "Deploy"
	
[139]: https://печатаетмаксим.рф/studio/?product=sticker "Live Studio"
	
[140]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/LIVE_UX_AUDIT_2026-08-14.md "Audit doc"
	
[141]: https://github.com/9627997/pechataet-maksim-site/releases/tag/backup-before-vertical-text-scale-clamp-20260814-1112 "Rollback"
	
[142]: https://github.com/9627997/pechataet-maksim-site/commit/b5c3e6c "Merge commit"
	
[143]: https://github.com/9627997/pechataet-maksim-site/commit/642be74 "Fix commit"
	
[144]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/ROUNDRECT_TEXT_BOUNDS_DIAGNOSIS.md "Diagnosis"
	
[145]: https://github.com/9627997/pechataet-maksim-site/blob/main/tests/studio-production.spec.js "Production test file"
	
[146]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/layout.js "Layout file"
	
[147]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/index.html "HTML file"
	
[148]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/app.js "JS file"
	
[149]: https://github.com/9627997/pechataet-maksim-site/blob/main/tests/studio-mobile.spec.js "Mobile file"
	
[150]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/LIVE_UX_AUDIT_2026-08-14.md "Live file"
	
[151]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/ROUNDRECT_TEXT_BOUNDS_DIAGNOSIS.md "Bounds file"
	
[152]: https://github.com/9627997/pechataet-maksim-site/blob/main/.github/workflows/ci.yml "CI workflow"
	
[153]: https://github.com/9627997/pechataet-maksim-site/blob/main/.github/workflows/deploy.yml "Deploy workflow"
	
[154]: https://github.com/9627997/pechataet-maksim-site/actions/runs/31795365127 "Deploy workflow run"
	
[155]: https://github.com/9627997/pechataet-maksim-site/pull/62/checks "Checks"
	
[156]: https://github.com/9627997/pechataet-maksim-site/pull/62 "PR #62"
	
[157]: https://печатаетмаксим.рф/studio/?product=sticker "Live Studio check"
	
[158]: https://github.com/9627997/pechataet-maksim-site/tags "Tags"
	
[159]: https://github.com/9627997/pechataet-maksim-site/releases/tag/backup-before-vertical-text-scale-clamp-20260814-1112 "Backup tag"
	
[160]: https://github.com/9627997/pechataet-maksim-site/commit/b5c3e6c "Main merge"
	
[161]: https://github.com/9627997/pechataet-maksim-site/actions/runs/31795365127 "Deployment success"
	
[162]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/LIVE_UX_AUDIT_2026-08-14.md "Audit"
	
[163]: https://github.com/9627997/pechataet-maksim-site/pull/62/checks "CI status"
	
[164]: https://github.com/9627997/pechataet-maksim-site/tree/main "Source"
	
[165]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/layout.js "Layout source"
	
[166]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/index.html "Index source"
	
[167]: https://github.com/9627997/pechataet-maksim-site/blob/main/tests/studio-production.spec.js "Regression source"
	
[168]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/LIVE_UX_AUDIT_2026-08-14.md "Audit source"
	
[169]: https://github.com/9627997/pechataet-maksim-site/pull/62 "PR"
	
[170]: https://github.com/9627997/pechataet-maksim-site/actions/runs/31795365127 "Deploy"
	
[171]: https://печатаетмаксим.рф/studio/?product=sticker "Production target"
	
[172]: https://github.com/9627997/pechataet-maksim-site/releases/tag/backup-before-vertical-text-scale-clamp-20260814-1112 "Backup target"
	
[173]: https://github.com/9627997/pechataet-maksim-site/commit/b5c3e6c "Commit target"
	
[174]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/LIVE_UX_AUDIT_2026-08-14.md "Final document"
	
[175]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/ROUNDRECT_TEXT_BOUNDS_DIAGNOSIS.md "Technical diagnosis"
	
[176]: https://github.com/9627997/pechataet-maksim-site/blob/main/tests/studio-production.spec.js "Tests"
	
[177]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/layout.js "Geometry logic"
	
[178]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/index.html "Controls"
	
[179]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/app.js "Controller"
	
[180]: https://github.com/9627997/pechataet-maksim-site/actions/runs/31795365127 "Deploy run"
	
[181]: https://github.com/9627997/pechataet-maksim-site/pull/62 "PR"
	
[182]: https://печатаетмаксим.рф/studio/?product=sticker "Live flow"
	
[183]: https://github.com/9627997/pechataet-maksim-site/releases/tag/backup-before-vertical-text-scale-clamp-20260814-1112 "Backup tag"
	
[184]: https://github.com/9627997/pechataet-maksim-site/commit/b5c3e6c "Deployed main"
	
[185]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/LIVE_UX_AUDIT_2026-08-14.md "Audit document"
	
[186]: https://github.com/9627997/pechataet-maksim-site/actions "Actions dashboard"
	
[187]: https://github.com/9627997/pechataet-maksim-site/pulls "PR list"
	
[188]: https://github.com/9627997/pechataet-maksim-site/tags "Tag list"
	
[189]: https://github.com/9627997/pechataet-maksim-site/commits/main "Commits"
	
[190]: https://github.com/9627997/pechataet-maksim-site/tree/main/studio "Studio tree"
	
[191]: https://github.com/9627997/pechataet-maksim-site/tree/main/tests "Test tree"
	
[192]: https://github.com/9627997/pechataet-maksim-site/tree/main/docs "Doc tree"
	
[193]: https://github.com/9627997/pechataet-maksim-site/pull/62/checks "Checks page"
	
[194]: https://github.com/9627997/pechataet-maksim-site/actions/runs/31795365127 "Successful run"
	
[195]: https://github.com/9627997/pechataet-maksim-site/blob/main/.github/workflows/deploy.yml "Deployment workflow"
	
[196]: https://github.com/9627997/pechataet-maksim-site/blob/main/.github/workflows/ci.yml "CI workflow"
	
[197]: https://github.com/9627997/pechataet-maksim-site/blob/main/package.json "Scripts"
	
[198]: https://github.com/9627997/pechataet-maksim-site/blob/main/README.md "README"
	
[199]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/LIVE_UX_AUDIT_2026-08-14.md "Audit source"
	
[200]: https://github.com/9627997/pechataet-maksim-site/pull/62 "Merged PR"
	
[201]: https://печатаетмаксим.рф/studio/?product=sticker "Production URL"
	
[202]: https://github.com/9627997/pechataet-maksim-site/releases/tag/backup-before-vertical-text-scale-clamp-20260814-1112 "Rollback URL"
	
[203]: https://github.com/9627997/pechataet-maksim-site/commit/b5c3e6c "Commit URL"
	
[204]: https://github.com/9627997/pechataet-maksim-site/actions/runs/31795365127 "Deploy URL"
	
[205]: https://github.com/9627997/pechataet-maksim-site/pull/62/checks "Checks URL"
	
[206]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/LIVE_UX_AUDIT_2026-08-14.md "Report URL"
	
[207]: https://печатаетмаксим.рф/studio/?product=sticker "Live URL"
	
[208]: https://github.com/9627997/pechataet-maksim-site/tree/main "Main URL"
	
[209]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/layout.js "Layout URL"
	
[210]: https://github.com/9627997/pechataet-maksim-site/blob/main/tests/studio-production.spec.js "Test URL"
	
[211]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/index.html "Index URL"
	
[212]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/app.js "App URL"
	
[213]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/ROUNDRECT_TEXT_BOUNDS_DIAGNOSIS.md "Diagnosis URL"
	
[214]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/geometry.js "Geometry URL"
	
[215]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/mobile-products.js "Mobile URL"
	
[216]: https://github.com/9627997/pechataet-maksim-site/actions "Actions URL"
	
[217]: https://github.com/9627997/pechataet-maksim-site/tags "Tags URL"
	
[218]: https://github.com/9627997/pechataet-maksim-site/pulls "Pulls URL"
	
[219]: https://github.com/9627997/pechataet-maksim-site/issues "Issues URL"
	
[220]: https://github.com/9627997/pechataet-maksim-site/security "Security URL"
	
[221]: https://github.com/9627997/pechataet-maksim-site/pulse "Pulse URL"
	
[222]: https://github.com/9627997/pechataet-maksim-site/graphs/traffic "Traffic URL"
	
[223]: https://github.com/9627997/pechataet-maksim-site/network "Network URL"
	
[224]: https://github.com/9627997/pechataet-maksim-site/tree/main "Tree URL"
	
[225]: https://github.com/9627997/pechataet-maksim-site/blob/main/README.md "Readme URL"
	
[226]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/LIVE_UX_AUDIT_2026-08-14.md "Audit URL"
	
[227]: https://github.com/9627997/pechataet-maksim-site/actions/runs/31795365127 "Workflow URL"
	
[228]: https://github.com/9627997/pechataet-maksim-site/pull/62 "PR URL"
	
[229]: https://печатаетмаксим.рф/studio/?product=sticker "Studio URL"
	
[230]: https://github.com/9627997/pechataet-maksim-site/releases/tag/backup-before-vertical-text-scale-clamp-20260814-1112 "Backup URL"
	
[231]: https://github.com/9627997/pechataet-maksim-site/commit/b5c3e6c "Main URL"
	
[232]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/LIVE_UX_AUDIT_2026-08-14.md "Audit URL"
	
[233]: https://github.com/9627997/pechataet-maksim-site/actions/runs/31795365127 "Deploy URL"
	
[234]: https://github.com/9627997/pechataet-maksim-site/pull/62/checks "Checks URL"
	
[235]: https://github.com/9627997/pechataet-maksim-site/blob/main/tests/studio-production.spec.js "Test URL"
	
[236]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/layout.js "Layout URL"
	
[237]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/index.html "Index URL"
	
[238]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/app.js "App URL"
	
[239]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/ROUNDRECT_TEXT_BOUNDS_DIAGNOSIS.md "Diagnosis URL"
	
[240]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/geometry.js "Geometry URL"
	
[241]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/mobile-products.js "Mobile URL"
	
[242]: https://github.com/9627997/pechataet-maksim-site/blob/main/.github/workflows/deploy.yml "Deploy URL"
	
[243]: https://github.com/9627997/pechataet-maksim-site/blob/main/.github/workflows/ci.yml "CI URL"
	
[244]: https://github.com/9627997/pechataet-maksim-site/blob/main/package.json "Package URL"
	
[245]: https://github.com/9627997/pechataet-maksim-site/blob/main/README.md "README URL"
	
[246]: https://github.com/9627997/pechataet-maksim-site "Repo URL"
	
[247]: https://github.com/9627997/pechataet-maksim-site/actions "Actions URL"
	
[248]: https://github.com/9627997/pechataet-maksim-site/tags "Tags URL"
	
[249]: https://github.com/9627997/pechataet-maksim-site/pulls "Pulls URL"
	
[250]: https://github.com/9627997/pechataet-maksim-site/issues "Issues URL"
	
[251]: https://github.com/9627997/pechataet-maksim-site/security "Security URL"
	
[252]: https://github.com/9627997/pechataet-maksim-site/pulse "Pulse URL"
	
[253]: https://github.com/9627997/pechataet-maksim-site/graphs/traffic "Traffic URL"
	
[254]: https://github.com/9627997/pechataet-maksim-site/network "Network URL"
	
[255]: https://github.com/9627997/pechataet-maksim-site/tree/main "Tree URL"
	
[256]: https://github.com/9627997/pechataet-maksim-site/blob/main/README.md "README URL"
	
[257]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/LIVE_UX_AUDIT_2026-08-14.md "Audit URL"
	
[258]: https://github.com/9627997/pechataet-maksim-site/actions/runs/31795365127 "Workflow URL"
	
[259]: https://github.com/9627997/pechataet-maksim-site/pull/62 "PR URL"
	
[260]: https://печатаетмаксим.рф/studio/?product=sticker "Studio URL"
	
[261]: https://github.com/9627997/pechataet-maksim-site/releases/tag/backup-before-vertical-text-scale-clamp-20260814-1112 "Backup URL"
	
[262]: https://github.com/9627997/pechataet-maksim-site/commit/b5c3e6c "Main URL"
	
[263]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/LIVE_UX_AUDIT_2026-08-14.md "Audit URL"
	
[264]: https://github.com/9627997/pechataet-maksim-site/actions/runs/31795365127 "Deploy URL"
	
[265]: https://github.com/9627997/pechataet-maksim-site/pull/62/checks "Checks URL"
	
[266]: https://github.com/9627997/pechataet-maksim-site/blob/main/tests/studio-production.spec.js "Test URL"
	
[267]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/layout.js "Layout URL"
	
[268]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/index.html "Index URL"
	
[269]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/app.js "App URL"
	
[270]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/ROUNDRECT_TEXT_BOUNDS_DIAGNOSIS.md "Diagnosis URL"
	
[271]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/geometry.js "Geometry URL"
	
[272]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/mobile-products.js "Mobile URL"
	
[273]: https://github.com/9627997/pechataet-maksim-site/blob/main/.github/workflows/deploy.yml "Deploy URL"
	
[274]: https://github.com/9627997/pechataet-maksim-site/blob/main/.github/workflows/ci.yml "CI URL"
	
[275]: https://github.com/9627997/pechataet-maksim-site/blob/main/package.json "Package URL"
	
[276]: https://github.com/9627997/pechataet-maksim-site/blob/main/README.md "README URL"
	
[277]: https://github.com/9627997/pechataet-maksim-site "Repository URL"
	
[278]: https://github.com/9627997/pechataet-maksim-site/actions "Actions URL"
	
[279]: https://github.com/9627997/pechataet-maksim-site/tags "Tags URL"
	
[280]: https://github.com/9627997/pechataet-maksim-site/pulls "Pulls URL"
	
[281]: https://github.com/9627997/pechataet-maksim-site/issues "Issues URL"
	
[282]: https://github.com/9627997/pechataet-maksim-site/security "Security URL"
	
[283]: https://github.com/9627997/pechataet-maksim-site/pulse "Pulse URL"
	
[284]: https://github.com/9627997/pechataet-maksim-site/graphs/traffic "Traffic URL"
	
[285]: https://github.com/9627997/pechataet-maksim-site/network "Network URL"
	
[286]: https://github.com/9627997/pechataet-maksim-site/tree/main "Main URL"
	
[287]: https://github.com/9627997/pechataet-maksim-site/blob/main/README.md "README URL"
	
[288]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/LIVE_UX_AUDIT_2026-08-14.md "Audit URL"
	
[289]: https://github.com/9627997/pechataet-maksim-site/actions/runs/31795365127 "Workflow URL"
	
[290]: https://github.com/9627997/pechataet-maksim-site/pull/62 "PR URL"
	
[291]: https://печатаетмаксим.рф/studio/?product=sticker "Studio URL"
	
[292]: https://github.com/9627997/pechataet-maksim-site/releases/tag/backup-before-vertical-text-scale-clamp-20260814-1112 "Backup URL"
	
[293]: https://github.com/9627997/pechataet-maksim-site/commit/b5c3e6c "Main URL"
	
[294]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/LIVE_UX_AUDIT_2026-08-14.md "Audit URL"
	
[295]: https://github.com/9627997/pechataet-maksim-site/actions/runs/31795365127 "Deploy URL"
	
[296]: https://github.com/9627997/pechataet-maksim-site/pull/62/checks "Checks URL"
	
[297]: https://github.com/9627997/pechataet-maksim-site/blob/main/tests/studio-production.spec.js "Test URL"
	
[298]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/layout.js "Layout URL"
	
[299]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/index.html "Index URL"
	
[300]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/app.js "App URL"
	
[301]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/ROUNDRECT_TEXT_BOUNDS_DIAGNOSIS.md "Diagnosis URL"
	
[302]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/geometry.js "Geometry URL"
	
[303]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/mobile-products.js "Mobile URL"
	
[304]: https://github.com/9627997/pechataet-maksim-site/blob/main/.github/workflows/deploy.yml "Deploy URL"
	
[305]: https://github.com/9627997/pechataet-maksim-site/blob/main/.github/workflows/ci.yml "CI URL"
	
[306]: https://github.com/9627997/pechataet-maksim-site/blob/main/package.json "Package URL"
	
[307]: https://github.com/9627997/pechataet-maksim-site/blob/main/README.md "README URL"
	
[308]: https://github.com/9627997/pechataet-maksim-site "Repository URL"
	
[309]: https://github.com/9627997/pechataet-maksim-site/actions "Actions URL"
	
[310]: https://github.com/9627997/pechataet-maksim-site/tags "Tags URL"
	
[311]: https://github.com/9627997/pechataet-maksim-site/pulls "Pulls URL"
	
[312]: https://github.com/9627997/pechataet-maksim-site/issues "Issues URL"
	
[313]: https://github.com/9627997/pechataet-maksim-site/security "Security URL"
	
[314]: https://github.com/9627997/pechataet-maksim-site/pulse "Pulse URL"
	
[315]: https://github.com/9627997/pechataet-maksim-site/graphs/traffic "Traffic URL"
	
[316]: https://github.com/9627997/pechataet-maksim-site/network "Network URL"
	
[317]: https://github.com/9627997/pechataet-maksim-site/tree/main "Main URL"
	
[318]: https://github.com/9627997/pechataet-maksim-site/blob/main/README.md "README URL"
	
[319]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/LIVE_UX_AUDIT_2026-08-14.md "Audit URL"
	
[320]: https://github.com/9627997/pechataet-maksim-site/actions/runs/31795365127 "Workflow URL"
	
[321]: https://github.com/9627997/pechataet-maksim-site/pull/62 "PR URL"
	
[322]: https://печатаетмаксим.рф/studio/?product=sticker "Studio URL"
	
[323]: https://github.com/9627997/pechataet-maksim-site/releases/tag/backup-before-vertical-text-scale-clamp-20260814-1112 "Backup URL"
	
[324]: https://github.com/9627997/pechataet-maksim-site/commit/b5c3e6c "Main URL"
	
[325]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/LIVE_UX_AUDIT_2026-08-14.md "Audit URL"
	
[326]: https://github.com/9627997/pechataet-maksim-site/actions/runs/31795365127 "Deploy URL"
	
[327]: https://github.com/9627997/pechataet-maksim-site/pull/62/checks "Checks URL"
	
[328]: https://github.com/9627997/pechataet-maksim-site/blob/main/tests/studio-production.spec.js "Test URL"
	
[329]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/layout.js "Layout URL"
	
[330]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/index.html "Index URL"
	
[331]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/app.js "App URL"
	
[332]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/ROUNDRECT_TEXT_BOUNDS_DIAGNOSIS.md "Diagnosis URL"
	
[333]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/geometry.js "Geometry URL"
	
[334]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/mobile-products.js "Mobile URL"
	
[335]: https://github.com/9627997/pechataet-maksim-site/blob/main/.github/workflows/deploy.yml "Deploy URL"
	
[336]: https://github.com/9627997/pechataet-maksim-site/blob/main/.github/workflows/ci.yml "CI URL"
	
[337]: https://github.com/9627997/pechataet-maksim-site/blob/main/package.json "Package URL"
	
[338]: https://github.com/9627997/pechataet-maksim-site/blob/main/README.md "README URL"
	
[339]: https://github.com/9627997/pechataet-maksim-site "Repository URL"
	
[340]: https://github.com/9627997/pechataet-maksim-site/actions "Actions URL"
	
[341]: https://github.com/9627997/pechataet-maksim-site/tags "Tags URL"
	
[342]: https://github.com/9627997/pechataet-maksim-site/pulls "Pulls URL"
	
[343]: https://github.com/9627997/pechataet-maksim-site/issues "Issues URL"
	
[344]: https://github.com/9627997/pechataet-maksim-site/security "Security URL"
	
[345]: https://github.com/9627997/pechataet-maksim-site/pulse "Pulse URL"
	
[346]: https://github.com/9627997/pechataet-maksim-site/graphs/traffic "Traffic URL"
	
[347]: https://github.com/9627997/pechataet-maksim-site/network "Network URL"
	
[348]: https://github.com/9627997/pechataet-maksim-site/tree/main "Main URL"
	
[349]: https://github.com/9627997/pechataet-maksim-site/blob/main/README.md "README URL"
	
[350]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/LIVE_UX_AUDIT_2026-08-14.md "Audit URL"
	
[351]: https://github.com/9627997/pechataet-maksim-site/actions/runs/31795365127 "Workflow URL"
	
[352]: https://github.com/9627997/pechataet-maksim-site/pull/62 "PR URL"
	
[353]: https://печатаетмаксим.рф/studio/?product=sticker "Studio URL"
	
[354]: https://github.com/9627997/pechataet-maksim-site/releases/tag/backup-before-vertical-text-scale-clamp-20260814-1112 "Backup URL"
	
[355]: https://github.com/9627997/pechataet-maksim-site/commit/b5c3e6c "Main URL"
	
[356]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/LIVE_UX_AUDIT_2026-08-14.md "Audit URL"
	
[357]: https://github.com/9627997/pechataet-maksim-site/actions/runs/31795365127 "Deploy URL"
	
[358]: https://github.com/9627997/pechataet-maksim-site/pull/62/checks "Checks URL"
	
[359]: https://github.com/9627997/pechataet-maksim-site/blob/main/tests/studio-production.spec.js "Test URL"
	
[360]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/layout.js "Layout URL"
	
[361]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/index.html "Index URL"
	
[362]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/app.js "App URL"
	
[363]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/ROUNDRECT_TEXT_BOUNDS_DIAGNOSIS.md "Diagnosis URL"
	
[364]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/geometry.js "Geometry URL"
	
[365]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/mobile-products.js "Mobile URL"
	
[366]: https://github.com/9627997/pechataet-maksim-site/blob/main/.github/workflows/deploy.yml "Deploy URL"
	
[367]: https://github.com/9627997/pechataet-maksim-site/blob/main/.github/workflows/ci.yml "CI URL"
	
[368]: https://github.com/9627997/pechataet-maksim-site/blob/main/package.json "Package URL"
	
[369]: https://github.com/9627997/pechataet-maksim-site/blob/main/README.md "README URL"
	
[370]: https://github.com/9627997/pechataet-maksim-site "Repository URL"
	
[371]: https://github.com/9627997/pechataet-maksim-site/actions "Actions URL"
	
[372]: https://github.com/9627997/pechataet-maksim-site/tags "Tags URL"
	
[373]: https://github.com/9627997/pechataet-maksim-site/pulls "Pulls URL"
	
[374]: https://github.com/9627997/pechataet-maksim-site/issues "Issues URL"
	
[375]: https://github.com/9627997/pechataet-maksim-site/security "Security URL"
	
[376]: https://github.com/9627997/pechataet-maksim-site/pulse "Pulse URL"
	
[377]: https://github.com/9627997/pechataet-maksim-site/graphs/traffic "Traffic URL"
	
[378]: https://github.com/9627997/pechataet-maksim-site/network "Network URL"
	
[379]: https://github.com/9627997/pechataet-maksim-site/tree/main "Main URL"
	
[380]: https://github.com/9627997/pechataet-maksim-site/blob/main/README.md "README URL"
	
[381]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/LIVE_UX_AUDIT_2026-08-14.md "Audit URL"
	
[382]: https://github.com/9627997/pechataet-maksim-site/actions/runs/31795365127 "Deployment URL"
	
[383]: https://github.com/9627997/pechataet-maksim-site/pull/62 "PR URL"
	
[384]: https://печатаетмаксим.рф/studio/?product=sticker "Production URL"
	
[385]: https://github.com/9627997/pechataet-maksim-site/releases/tag/backup-before-vertical-text-scale-clamp-20260814-1112 "Backup URL"
	
[386]: https://github.com/9627997/pechataet-maksim-site/commit/b5c3e6c "Merge URL"
	
[387]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/LIVE_UX_AUDIT_2026-08-14.md "Report URL"
	
[388]: https://github.com/9627997/pechataet-maksim-site/actions/runs/31795365127 "Run URL"
	
[389]: https://github.com/9627997/pechataet-maksim-site/pull/62/checks "Checks URL"
	
[390]: https://github.com/9627997/pechataet-maksim-site/blob/main/tests/studio-production.spec.js "Test URL"
	
[391]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/layout.js "Layout URL"
	
[392]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/index.html "Index URL"
	
[393]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/app.js "App URL"
	
[394]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/ROUNDRECT_TEXT_BOUNDS_DIAGNOSIS.md "Diagnosis URL"
	
[395]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/geometry.js "Geometry URL"
	
[396]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/mobile-products.js "Mobile URL"
	
[397]: https://github.com/9627997/pechataet-maksim-site/blob/main/.github/workflows/deploy.yml "Deploy URL"
	
[398]: https://github.com/9627997/pechataet-maksim-site/blob/main/.github/workflows/ci.yml "CI URL"
	
[399]: https://github.com/9627997/pechataet-maksim-site/blob/main/package.json "Package URL"
	
[400]: https://github.com/9627997/pechataet-maksim-site/blob/main/README.md "README URL"
	
[401]: https://github.com/9627997/pechataet-maksim-site "Repository URL"
	
[402]: https://github.com/9627997/pechataet-maksim-site/actions "Actions URL"
	
[403]: https://github.com/9627997/pechataet-maksim-site/tags "Tags URL"
	
[404]: https://github.com/9627997/pechataet-maksim-site/pulls "Pulls URL"
	
[405]: https://github.com/9627997/pechataet-maksim-site/issues "Issues URL"
	
[406]: https://github.com/9627997/pechataet-maksim-site/security "Security URL"
	
[407]: https://github.com/9627997/pechataet-maksim-site/pulse "Pulse URL"
	
[408]: https://github.com/9627997/pechataet-maksim-site/graphs/traffic "Traffic URL"
	
[409]: https://github.com/9627997/pechataet-maksim-site/network "Network URL"
	
[410]: https://github.com/9627997/pechataet-maksim-site/tree/main "Main URL"
	
[411]: https://github.com/9627997/pechataet-maksim-site/blob/main/README.md "README URL"
	
[412]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/LIVE_UX_AUDIT_2026-08-14.md "Live report"
	
[413]: https://github.com/9627997/pechataet-maksim-site/actions/runs/31795365127 "Deployment run"
	
[414]: https://github.com/9627997/pechataet-maksim-site/pull/62 "Merged PR"
	
[415]: https://печатаетмаксим.рф/studio/?product=sticker "Production Studio"
	
[416]: https://github.com/9627997/pechataet-maksim-site/releases/tag/backup-before-vertical-text-scale-clamp-20260814-1112 "Backup tag"
	
[417]: https://github.com/9627997/pechataet-maksim-site/commit/b5c3e6c "Main commit"
	
[418]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/LIVE_UX_AUDIT_2026-08-14.md "Audit"
	
[419]: https://github.com/9627997/pechataet-maksim-site/actions/runs/31795365127 "Deploy"
	
[420]: https://github.com/9627997/pechataet-maksim-site/pull/62/checks "Checks"
	
[421]: https://github.com/9627997/pechataet-maksim-site/blob/main/tests/studio-production.spec.js "Tests"
	
[422]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/layout.js "Layout"
	
[423]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/index.html "Index"
	
[424]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/app.js "App"
	
[425]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/ROUNDRECT_TEXT_BOUNDS_DIAGNOSIS.md "Diagnosis"
	
[426]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/geometry.js "Geometry"
	
[427]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/mobile-products.js "Mobile"
	
[428]: https://github.com/9627997/pechataet-maksim-site/blob/main/.github/workflows/deploy.yml "Deploy"
	
[429]: https://github.com/9627997/pechataet-maksim-site/blob/main/.github/workflows/ci.yml "CI"
	
[430]: https://github.com/9627997/pechataet-maksim-site/blob/main/package.json "Package"
	
[431]: https://github.com/9627997/pechataet-maksim-site/blob/main/README.md "README"
	
[432]: https://github.com/9627997/pechataet-maksim-site "Repo"
	
[433]: https://github.com/9627997/pechataet-maksim-site/actions "Actions"
	
[434]: https://github.com/9627997/pechataet-maksim-site/tags "Tags"
	
[435]: https://github.com/9627997/pechataet-maksim-site/pulls "Pull requests"
	
[436]: https://github.com/9627997/pechataet-maksim-site/issues "Issues"
	
[437]: https://github.com/9627997/pechataet-maksim-site/security "Security"
	
[438]: https://github.com/9627997/pechataet-maksim-site/pulse "Pulse"
	
[439]: https://github.com/9627997/pechataet-maksim-site/graphs/traffic "Traffic"
	
[440]: https://github.com/9627997/pechataet-maksim-site/network "Network"
	
[441]: https://github.com/9627997/pechataet-maksim-site/tree/main "Main"
	
[442]: https://github.com/9627997/pechataet-maksim-site/blob/main/README.md "README"
	
[443]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/LIVE_UX_AUDIT_2026-08-14.md "Audit"
	
[444]: https://github.com/9627997/pechataet-maksim-site/actions/runs/31795365127 "Deploy"
	
[445]: https://github.com/9627997/pechataet-maksim-site/pull/62 "PR"
	
[446]: https://печатаетмаксим.рф/studio/?product=sticker "Live"
	
[447]: https://github.com/9627997/pechataet-maksim-site/releases/tag/backup-before-vertical-text-scale-clamp-20260814-1112 "Backup"
	
[448]: https://github.com/9627997/pechataet-maksim-site/commit/b5c3e6c "Merge"
	
[449]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/LIVE_UX_AUDIT_2026-08-14.md "Doc"
	
[450]: https://github.com/9627997/pechataet-maksim-site/actions/runs/31795365127 "Run"
	
[451]: https://github.com/9627997/pechataet-maksim-site/pull/62/checks "Checks"
	
[452]: https://github.com/9627997/pechataet-maksim-site/blob/main/tests/studio-production.spec.js "Test"
	
[453]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/layout.js "Layout"
	
[454]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/index.html "HTML"
	
[455]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/app.js "JS"
	
[456]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/ROUNDRECT_TEXT_BOUNDS_DIAGNOSIS.md "Diag"
	
[457]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/geometry.js "Geo"
	
[458]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/mobile-products.js "Mobile"
	
[459]: https://github.com/9627997/pechataet-maksim-site/blob/main/.github/workflows/deploy.yml "Deploy"
	
[460]: https://github.com/9627997/pechataet-maksim-site/blob/main/.github/workflows/ci.yml "CI"
	
[461]: https://github.com/9627997/pechataet-maksim-site/blob/main/package.json "Package"
	
[462]: https://github.com/9627997/pechataet-maksim-site/blob/main/README.md "Readme"
	
[463]: https://github.com/9627997/pechataet-maksim-site "GitHub"
	
[464]: https://github.com/9627997/pechataet-maksim-site/actions "Actions"
	
[465]: https://github.com/9627997/pechataet-maksim-site/tags "Tags"
	
[466]: https://github.com/9627997/pechataet-maksim-site/pulls "PRs"
	
[467]: https://github.com/9627997/pechataet-maksim-site/issues "Issues"
	
[468]: https://github.com/9627997/pechataet-maksim-site/security "Security"
	
[469]: https://github.com/9627997/pechataet-maksim-site/pulse "Pulse"
	
[470]: https://github.com/9627997/pechataet-maksim-site/graphs/traffic "Traffic"
	
[471]: https://github.com/9627997/pechataet-maksim-site/network "Network"
	
[472]: https://github.com/9627997/pechataet-maksim-site/tree/main "Main"
	
[473]: https://github.com/9627997/pechataet-maksim-site/blob/main/README.md "README"
	
[474]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/LIVE_UX_AUDIT_2026-08-14.md "Audit"
	
[475]: https://github.com/9627997/pechataet-maksim-site/actions/runs/31795365127 "Deploy"
	
[476]: https://github.com/9627997/pechataet-maksim-site/pull/62 "PR"
	
[477]: https://печатаетмаксим.рф/studio/?product=sticker "Production"
	
[478]: https://github.com/9627997/pechataet-maksim-site/releases/tag/backup-before-vertical-text-scale-clamp-20260814-1112 "Backup"
	
[479]: https://github.com/9627997/pechataet-maksim-site/commit/b5c3e6c "Commit"
	
[480]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/LIVE_UX_AUDIT_2026-08-14.md "Report"
	
[481]: https://github.com/9627997/pechataet-maksim-site/actions/runs/31795365127 "Deploy"
	
[482]: https://github.com/9627997/pechataet-maksim-site/pull/62/checks "Checks"
	
[483]: https://github.com/9627997/pechataet-maksim-site/blob/main/tests/studio-production.spec.js "Test"
	
[484]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/layout.js "Layout"
	
[485]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/index.html "Index"
	
[486]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/app.js "App"
	
[487]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/ROUNDRECT_TEXT_BOUNDS_DIAGNOSIS.md "Diagnosis"
	
[488]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/geometry.js "Geometry"
	
[489]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/mobile-products.js "Mobile"
	
[490]: https://github.com/9627997/pechataet-maksim-site/blob/main/.github/workflows/deploy.yml "Deploy"
	
[491]: https://github.com/9627997/pechataet-maksim-site/blob/main/.github/workflows/ci.yml "CI"
	
[492]: https://github.com/9627997/pechataet-maksim-site/blob/main/package.json "Package"
	
[493]: https://github.com/9627997/pechataet-maksim-site/blob/main/README.md "README"
	
[494]: https://github.com/9627997/pechataet-maksim-site "Repository"
	
[495]: https://github.com/9627997/pechataet-maksim-site/actions "Actions"
	
[496]: https://github.com/9627997/pechataet-maksim-site/tags "Tags"
	
[497]: https://github.com/9627997/pechataet-maksim-site/pulls "Pulls"
	
[498]: https://github.com/9627997/pechataet-maksim-site/issues "Issues"
	
[499]: https://github.com/9627997/pechataet-maksim-site/security "Security"
	
[500]: https://github.com/9627997/pechataet-maksim-site/pulse "Pulse"
	
[501]: https://github.com/9627997/pechataet-maksim-site/graphs/traffic "Traffic"
	
[502]: https://github.com/9627997/pechataet-maksim-site/network "Network"
	
[503]: https://github.com/9627997/pechataet-maksim-site/tree/main "Tree"
	
[504]: https://github.com/9627997/pechataet-maksim-site/blob/main/README.md "README"
	
[505]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/LIVE_UX_AUDIT_2026-08-14.md "Live audit"
	
[506]: https://github.com/9627997/pechataet-maksim-site/actions/runs/31795365127 "Deploy run"
	
[507]: https://github.com/9627997/pechataet-maksim-site/pull/62 "PR	e[508]: https://печатаетмаксим.рф/studio/?product=sticker "Production"
	
[509]: https://github.com/9627997/pechataet-maksim-site/releases/tag/backup-before-vertical-text-scale-clamp-20260814-1112 "Backup"
	
[510]: https://github.com/9627997/pechataet-maksim-site/commit/b5c3e6c "Merge commit"
	
[511]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/LIVE_UX_AUDIT_2026-08-14.md "Audit"
	
[512]: https://github.com/9627997/pechataet-maksim-site/actions/runs/31795365127 "Deployment"
	
[513]: https://github.com/9627997/pechataet-maksim-site/pull/62/checks "Checks"
	
[514]: https://github.com/9627997/pechataet-maksim-site/blob/main/tests/studio-production.spec.js "Test"
	
[515]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/layout.js "Layout"
	
[516]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/index.html "Index"
	
[517]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/app.js "App"
	
[518]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/ROUNDRECT_TEXT_BOUNDS_DIAGNOSIS.md "Diagnosis"
	
[519]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/geometry.js "Geometry"
	
[520]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/mobile-products.js "Mobile"
	
[521]: https://github.com/9627997/pechataet-maksim-site/blob/main/.github/workflows/deploy.yml "Deploy"
	
[522]: https://github.com/9627997/pechataet-maksim-site/blob/main/.github/workflows/ci.yml "CI"
	
[523]: https://github.com/9627997/pechataet-maksim-site/blob/main/package.json "Package"
	
[524]: https://github.com/9627997/pechataet-maksim-site/blob/main/README.md "README"
	
[525]: https://github.com/9627997/pechataet-maksim-site "GitHub"
	
[526]: https://github.com/9627997/pechataet-maksim-site/actions "Actions"
	
[527]: https://github.com/9627997/pechataet-maksim-site/tags "Tags"
	
[528]: https://github.com/9627997/pechataet-maksim-site/pulls "Pull requests"
	
[529]: https://github.com/9627997/pechataet-maksim-site/issues "Issues"
	
[530]: https://github.com/9627997/pechataet-maksim-site/security "Security"
	
[531]: https://github.com/9627997/pechataet-maksim-site/pulse "Pulse"
	
[532]: https://github.com/9627997/pechataet-maksim-site/graphs/traffic "Traffic"
	
[533]: https://github.com/9627997/pechataet-maksim-site/network "Network"
	
[534]: https://github.com/9627997/pechataet-maksim-site/tree/main "Main"
	
[535]: https://github.com/9627997/pechataet-maksim-site/blob/main/README.md "README"
	
[536]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/LIVE_UX_AUDIT_2026-08-14.md "Audit"
	
[537]: https://github.com/9627997/pechataet-maksim-site/actions/runs/31795365127 "Deploy"
	
[538]: https://github.com/9627997/pechataet-maksim-site/pull/62 "PR"
	
[539]: https://печатаетмаксим.рф/studio/?product=sticker "Live Studio"
	
[540]: https://github.com/9627997/pechataet-maksim-site/releases/tag/backup-before-vertical-text-scale-clamp-20260814-1112 "Backup"
	
[541]: https://github.com/9627997/pechataet-maksim-site/commit/b5c3e6c "Main commit"
	
[542]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/LIVE_UX_AUDIT_2026-08-14.md "Audit doc"
	
[543]: https://github.com/9627997/pechataet-maksim-site/actions/runs/31795365127 "Deploy"
	
[544]: https://github.com/9627997/pechataet-maksim-site/pull/62/checks "Checks"
	
[545]: https://github.com/9627997/pechataet-maksim-site/blob/main/tests/studio-production.spec.js "Regression"
	
[546]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/layout.js "Layout"
	
[547]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/index.html "Index"
	
[548]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/app.js "App"
	
[549]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/ROUNDRECT_TEXT_BOUNDS_DIAGNOSIS.md "Diagnosis"
	
[550]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/geometry.js "Geometry"
	
[551]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/mobile-products.js "Mobile"
	
[552]: https://github.com/9627997/pechataet-maksim-site/blob/main/.github/workflows/deploy.yml "Deploy"
	
[553]: https://github.com/9627997/pechataet-maksim-site/blob/main/.github/workflows/ci.yml "CI"
	
[554]: https://github.com/9627997/pechataet-maksim-site/blob/main/package.json "Package"
	
[555]: https://github.com/9627997/pechataet-maksim-site/blob/main/README.md "README"
	
[556]: https://github.com/9627997/pechataet-maksim-site "Repository"
	
[557]: https://github.com/9627997/pechataet-maksim-site/actions "Actions"
	
[558]: https://github.com/9627997/pechataet-maksim-site/tags "Tags"
	
[559]: https://github.com/9627997/pechataet-maksim-site/pulls "PRs"
	
[560]: https://github.com/9627997/pechataet-maksim-site/issues "Issues"
	
[561]: https://github.com/9627997/pechataet-maksim-site/security "Security"
	
[562]: https://github.com/9627997/pechataet-maksim-site/pulse "Pulse"
	
[563]: https://github.com/9627997/pechataet-maksim-site/graphs/traffic "Traffic"
	
[564]: https://github.com/9627997/pechataet-maksim-site/network "Network"
	
[565]: https://github.com/9627997/pechataet-maksim-site/tree/main "Main"
	
[566]: https://github.com/9627997/pechataet-maksim-site/blob/main/README.md "README"
	
[567]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/LIVE_UX_AUDIT_2026-08-14.md "Audit"
	
[568]: https://github.com/9627997/pechataet-maksim-site/actions/runs/31795365127 "Deploy"
	
[569]: https://github.com/9627997/pechataet-maksim-site/pull/62 "PR	e[570]: https://печатаетмаксим.рф/studio/?product=sticker "Live"
	
[571]: https://github.com/9627997/pechataet-maksim-site/releases/tag/backup-before-vertical-text-scale-clamp-20260814-1112 "Backup"
	
[572]: https://github.com/9627997/pechataet-maksim-site/commit/b5c3e6c "Merge"
	
[573]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/LIVE_UX_AUDIT_2026-08-14.md "Audit"
	
[574]: https://github.com/9627997/pechataet-maksim-site/actions/runs/31795365127 "Deploy"
	
[575]: https://github.com/9627997/pechataet-maksim-site/pull/62/checks "Checks"
	
[576]: https://github.com/9627997/pechataet-maksim-site/blob/main/tests/studio-production.spec.js "Test"
	
[577]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/layout.js "Layout"
	
[578]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/index.html "Index"
	
[579]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/app.js "App"
	
[580]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/ROUNDRECT_TEXT_BOUNDS_DIAGNOSIS.md "Diagnosis"
	
[581]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/geometry.js "Geometry"
	
[582]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/mobile-products.js "Mobile"
	
[583]: https://github.com/9627997/pechataet-maksim-site/blob/main/.github/workflows/deploy.yml "Deploy"
	
[584]: https://github.com/9627997/pechataet-maksim-site/blob/main/.github/workflows/ci.yml "CI"
	
[585]: https://github.com/9627997/pechataet-maksim-site/blob/main/package.json "Package"
	
[586]: https://github.com/9627997/pechataet-maksim-site/blob/main/README.md "README"
	
[587]: https://github.com/9627997/pechataet-maksim-site "Repo"
	
[588]: https://github.com/9627997/pechataet-maksim-site/actions "Actions"
	
[589]: https://github.com/9627997/pechataet-maksim-site/tags "Tags"
	
[590]: https://github.com/9627997/pechataet-maksim-site/pulls "PRs"
	
[591]: https://github.com/9627997/pechataet-maksim-site/issues "Issues"
	
[592]: https://github.com/9627997/pechataet-maksim-site/security "Security"
	
[593]: https://github.com/9627997/pechataet-maksim-site/pulse "Pulse"
	
[594]: https://github.com/9627997/pechataet-maksim-site/graphs/traffic "Traffic"
	
[595]: https://github.com/9627997/pechataet-maksim-site/network "Network"
	
[596]: https://github.com/9627997/pechataet-maksim-site/tree/main "Main"
	
[597]: https://github.com/9627997/pechataet-maksim-site/blob/main/README.md "README"
	
[598]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/LIVE_UX_AUDIT_2026-08-14.md "Audit"
	
[599]: https://github.com/9627997/pechataet-maksim-site/actions/runs/31795365127 "Deploy"
	
[600]: https://github.com/9627997/pechataet-maksim-site/pull/62 "PR"
	
[601]: https://печатаетмаксим.рф/studio/?product=sticker "Production"
	
[602]: https://github.com/9627997/pechataet-maksim-site/releases/tag/backup-before-vertical-text-scale-clamp-20260814-1112 "Backup"
	
[603]: https://github.com/9627997/pechataet-maksim-site/commit/b5c3e6c "Commit"
	
[604]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/LIVE_UX_AUDIT_2026-08-14.md "Report"
	
[605]: https://github.com/9627997/pechataet-maksim-site/actions/runs/31795365127 "Deploy"
	
[606]: https://github.com/9627997/pechataet-maksim-site/pull/62/checks "Checks"
	
[607]: https://github.com/9627997/pechataet-maksim-site/blob/main/tests/studio-production.spec.js "Tests"
	
[608]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/layout.js "Layout"
	
[609]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/index.html "Index"
	
[610]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/app.js "App"
	
[611]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/ROUNDRECT_TEXT_BOUNDS_DIAGNOSIS.md "Diagnosis"
	
[612]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/geometry.js "Geometry"
	
[613]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/mobile-products.js "Mobile"
	
[614]: https://github.com/9627997/pechataet-maksim-site/blob/main/.github/workflows/deploy.yml "Deploy"
	
[615]: https://github.com/9627997/pechataet-maksim-site/blob/main/.github/workflows/ci.yml "CI"
	
[616]: https://github.com/9627997/pechataet-maksim-site/blob/main/package.json "Package"
	
[617]: https://github.com/9627997/pechataet-maksim-site/blob/main/README.md "README"
	
[618]: https://github.com/9627997/pechataet-maksim-site "Repo"
	
[619]: https://github.com/9627997/pechataet-maksim-site/actions "Actions"
	
[620]: https://github.com/9627997/pechataet-maksim-site/tags "Tags"
	
[621]: https://github.com/9627997/pechataet-maksim-site/pulls "PR"
	
[622]: https://github.com/9627997/pechataet-maksim-site/issues "Issues"
	
[623]: https://github.com/9627997/pechataet-maksim-site/security "Security"
	
[624]: https://github.com/9627997/pechataet-maksim-site/pulse "Pulse"
	
[625]: https://github.com/9627997/pechataet-maksim-site/graphs/traffic "Traffic"
	
[626]: https://github.com/9627997/pechataet-maksim-site/network "Network"
	
[627]: https://github.com/9627997/pechataet-maksim-site/tree/main "Main"
	
[628]: https://github.com/9627997/pechataet-maksim-site/blob/main/README.md "README"
	
[629]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/LIVE_UX_AUDIT_2026-08-14.md "Audit"
	
[630]: https://github.com/9627997/pechataet-maksim-site/actions/runs/31795365127 "Deploy"
	
[631]: https://github.com/9627997/pechataet-maksim-site/pull/62 "PR"
	
[632]: https://печатаетмаксим.рф/studio/?product=sticker "Live"
	
[633]: https://github.com/9627997/pechataet-maksim-site/releases/tag/backup-before-vertical-text-scale-clamp-20260814-1112 "Backup"
	
[634]: https://github.com/9627997/pechataet-maksim-site/commit/b5c3e6c "Main"
	
[635]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/LIVE_UX_AUDIT_2026-08-14.md "Doc"
	
[636]: https://github.com/9627997/pechataet-maksim-site/actions/runs/31795365127 "Workflow"
	
[637]: https://github.com/9627997/pechataet-maksim-site/pull/62/checks "Checks"
	
[638]: https://github.com/9627997/pechataet-maksim-site/blob/main/tests/studio-production.spec.js "Test"
	
[639]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/layout.js "Layout"
	
[640]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/index.html "Index"
	
[641]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/app.js "App"
	
[642]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/ROUNDRECT_TEXT_BOUNDS_DIAGNOSIS.md "Diagnosis"
	
[643]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/geometry.js "Geometry"
	
[644]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/mobile-products.js "Mobile"
	
[645]: https://github.com/9627997/pechataet-maksim-site/blob/main/.github/workflows/deploy.yml "Deploy"
	
[646]: https://github.com/9627997/pechataet-maksim-site/blob/main/.github/workflows/ci.yml "CI"
	
[647]: https://github.com/9627997/pechataet-maksim-site/blob/main/package.json "Package"
	
[648]: https://github.com/9627997/pechataet-maksim-site/blob/main/README.md "README"
	
[649]: https://github.com/9627997/pechataet-maksim-site "Repo"
	
[650]: https://github.com/9627997/pechataet-maksim-site/actions "Actions"
	
[651]: https://github.com/9627997/pechataet-maksim-site/tags "Tags"
	
[652]: https://github.com/9627997/pechataet-maksim-site/pulls "Pulls"
	
[653]: https://github.com/9627997/pechataet-maksim-site/issues "Issues"
	
[654]: https://github.com/9627997/pechataet-maksim-site/security "Security"
	
[655]: https://github.com/9627997/pechataet-maksim-site/pulse "Pulse"
	
[656]: https://github.com/9627997/pechataet-maksim-site/graphs/traffic "Traffic"
	
[657]: https://github.com/9627997/pechataet-maksim-site/network "Network"
	
[658]: https://github.com/9627997/pechataet-maksim-site/tree/main "Main"
	
[659]: https://github.com/9627997/pechataet-maksim-site/blob/main/README.md "README"
	
[660]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/LIVE_UX_AUDIT_2026-08-14.md "Audit"
	
[661]: https://github.com/9627997/pechataet-maksim-site/actions/runs/31795365127 "Deploy"
	
[662]: https://github.com/9627997/pechataet-maksim-site/pull/62 "PR"
	
[663]: https://печатаетмаксим.рф/studio/?product=sticker "Production"
	
[664]: https://github.com/9627997/pechataet-maksim-site/releases/tag/backup-before-vertical-text-scale-clamp-20260814-1112 "Backup"
	
[665]: https://github.com/9627997/pechataet-maksim-site/commit/b5c3e6c "Main commit"
	
[666]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/LIVE_UX_AUDIT_2026-08-14.md "Audit doc"
	
[667]: https://github.com/9627997/pechataet-maksim-site/actions/runs/31795365127 "Deploy run"
	
[668]: https://github.com/9627997/pechataet-maksim-site/pull/62/checks "Checks"
	
[669]: https://github.com/9627997/pechataet-maksim-site/blob/main/tests/studio-production.spec.js "Tests"
	
[670]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/layout.js "Layout"
	
[671]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/index.html "Index"
	
[672]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/app.js "App"
	
[673]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/ROUNDRECT_TEXT_BOUNDS_DIAGNOSIS.md "Diagnosis"
	
[674]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/geometry.js "Geometry"
	
[675]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/mobile-products.js "Mobile"
	
[676]: https://github.com/9627997/pechataet-maksim-site/blob/main/.github/workflows/deploy.yml "Deploy"
	
[677]: https://github.com/9627997/pechataet-maksim-site/blob/main/.github/workflows/ci.yml "CI"
	
[678]: https://github.com/9627997/pechataet-maksim-site/blob/main/package.json "Package"
	
[679]: https://github.com/9627997/pechataet-maksim-site/blob/main/README.md "README"
	
[680]: https://github.com/9627997/pechataet-maksim-site "Repository"
	
[681]: https://github.com/9627997/pechataet-maksim-site/actions "Actions"
	
[682]: https://github.com/9627997/pechataet-maksim-site/tags "Tags"
	
[683]: https://github.com/9627997/pechataet-maksim-site/pulls "Pull requests"
	
[684]: https://github.com/9627997/pechataet-maksim-site/issues "Issues"
	
[685]: https://github.com/9627997/pechataet-maksim-site/security "Security"
	
[686]: https://github.com/9627997/pechataet-maksim-site/pulse "Pulse"
	
[687]: https://github.com/9627997/pechataet-maksim-site/graphs/traffic "Traffic"
	
[688]: https://github.com/9627997/pechataet-maksim-site/network "Network"
	
[689]: https://github.com/9627997/pechataet-maksim-site/tree/main "Main"
	
[690]: https://github.com/9627997/pechataet-maksim-site/blob/main/README.md "README"
	
[691]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/LIVE_UX_AUDIT_2026-08-14.md "Audit"
	
[692]: https://github.com/9627997/pechataet-maksim-site/actions/runs/31795365127 "Deployment"
	
[693]: https://github.com/9627997/pechataet-maksim-site/pull/62 "PR"
	
[694]: https://печатаетмаксим.рф/studio/?product=sticker "Live"
	
[695]: https://github.com/9627997/pechataet-maksim-site/releases/tag/backup-before-vertical-text-scale-clamp-20260814-1112 "Backup"
	
[696]: https://github.com/9627997/pechataet-maksim-site/commit/b5c3e6c "Merge"
	
[697]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/LIVE_UX_AUDIT_2026-08-14.md "Audit"
	
[698]: https://github.com/9627997/pechataet-maksim-site/actions/runs/31795365127 "Run"
	
[699]: https://github.com/9627997/pechataet-maksim-site/pull/62/checks "Checks"
	
[700]: https://github.com/9627997/pechataet-maksim-site/blob/main/tests/studio-production.spec.js "Test"
	
[701]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/layout.js "Layout"
	
[702]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/index.html "Index"
	
[703]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/app.js "App"
	
[704]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/ROUNDRECT_TEXT_BOUNDS_DIAGNOSIS.md "Diagnosis"
	
[705]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/geometry.js "Geometry"
	
[706]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/mobile-products.js "Mobile"
	
[707]: https://github.com/9627997/pechataet-maksim-site/blob/main/.github/workflows/deploy.yml "Deploy"
	
[708]: https://github.com/9627997/pechataet-maksim-site/blob/main/.github/workflows/ci.yml "CI"
	
[709]: https://github.com/9627997/pechataet-maksim-site/blob/main/package.json "Package"
	
[710]: https://github.com/9627997/pechataet-maksim-site/blob/main/README.md "README"
	
[711]: https://github.com/9627997/pechataet-maksim-site "Repo"
	
[712]: https://github.com/9627997/pechataet-maksim-site/actions "Actions"
	
[713]: https://github.com/9627997/pechataet-maksim-site/tags "Tags"
	
[714]: https://github.com/9627997/pechataet-maksim-site/pulls "Pulls"
	
[715]: https://github.com/9627997/pechataet-maksim-site/issues "Issues"
	
[716]: https://github.com/9627997/pechataet-maksim-site/security "Security"
	
[717]: https://github.com/9627997/pechataet-maksim-site/pulse "Pulse"
	
[718]: https://github.com/9627997/pechataet-maksim-site/graphs/traffic "Traffic"
	
[719]: https://github.com/9627997/pechataet-maksim-site/network "Network"
	
[720]: https://github.com/9627997/pechataet-maksim-site/tree/main "Main"
	
[721]: https://github.com/9627997/pechataet-maksim-site/blob/main/README.md "README"
	
[722]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/LIVE_UX_AUDIT_2026-08-14.md "Audit"
	
[723]: https://github.com/9627997/pechataet-maksim-site/actions/runs/31795365127 "Deploy"
	
[724]: https://github.com/9627997/pechataet-maksim-site/pull/62 "PR"
	
[725]: https://печатаетмаксим.рф/studio/?product=sticker "Studio"
	
[726]: https://github.com/9627997/pechataet-maksim-site/releases/tag/backup-before-vertical-text-scale-clamp-20260814-1112 "Backup"
	
[727]: https://github.com/9627997/pechataet-maksim-site/commit/b5c3e6c "Merge commit"
	
[728]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/LIVE_UX_AUDIT_2026-08-14.md "Audit"
	
[729]: https://github.com/9627997/pechataet-maksim-site/actions/runs/31795365127 "Deployment"
	
[730]: https://github.com/9627997/pechataet-maksim-site/pull/62/checks "Checks"
	
[731]: https://github.com/9627997/pechataet-maksim-site/blob/main/tests/studio-production.spec.js "Tests"
	
[732]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/layout.js "Layout"
	
[733]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/index.html "Index"
	
[734]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/app.js "App"
	
[735]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/ROUNDRECT_TEXT_BOUNDS_DIAGNOSIS.md "Diagnosis"
	
[736]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/geometry.js "Geometry"
	
[737]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/mobile-products.js "Mobile"
	
[738]: https://github.com/9627997/pechataet-maksim-site/blob/main/.github/workflows/deploy.yml "Deploy"
	
[739]: https://github.com/9627997/pechataet-maksim-site/blob/main/.github/workflows/ci.yml "CI"
	
[740]: https://github.com/9627997/pechataet-maksim-site/blob/main/package.json "Package"
	
[741]: https://github.com/9627997/pechataet-maksim-site/blob/main/README.md "README"
	
[742]: https://github.com/9627997/pechataet-maksim-site "Repository"
	
[743]: https://github.com/9627997/pechataet-maksim-site/actions "Actions"
	
[744]: https://github.com/9627997/pechataet-maksim-site/tags "Tags"
	
[745]: https://github.com/9627997/pechataet-maksim-site/pulls "Pull requests"
	
[746]: https://github.com/9627997/pechataet-maksim-site/issues "Issues"
	
[747]: https://github.com/9627997/pechataet-maksim-site/security "Security"
	
[748]: https://github.com/9627997/pechataet-maksim-site/pulse "Pulse"
	
[749]: https://github.com/9627997/pechataet-maksim-site/graphs/traffic "Traffic"
	
[750]: https://github.com/9627997/pechataet-maksim-site/network "Network"
	
[751]: https://github.com/9627997/pechataet-maksim-site/tree/main "Main"
	
[752]: https://github.com/9627997/pechataet-maksim-site/blob/main/README.md "README"
	
[753]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/LIVE_UX_AUDIT_2026-08-14.md "Audit"
	
[754]: https://github.com/9627997/pechataet-maksim-site/actions/runs/31795365127 "Deploy"
	
[755]: https://github.com/9627997/pechataet-maksim-site/pull/62 "PR"
	
[756]: https://печатаетмаксим.рф/studio/?product=sticker "Production"
	
[757]: https://github.com/9627997/pechataet-maksim-site/releases/tag/backup-before-vertical-text-scale-clamp-20260814-1112 "Backup"
	
[758]: https://github.com/9627997/pechataet-maksim-site/commit/b5c3e6c "Main"
	
[759]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/LIVE_UX_AUDIT_2026-08-14.md "Audit"
	
[760]: https://github.com/9627997/pechataet-maksim-site/actions/runs/31795365127 "Deploy"
	
[761]: https://github.com/9627997/pechataet-maksim-site/pull/62/checks "Checks"
	
[762]: https://github.com/9627997/pechataet-maksim-site/blob/main/tests/studio-production.spec.js "Test"
	
[763]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/layout.js "Layout"
	
[764]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/index.html "Index"
	
[765]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/app.js "App"
	
[766]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/ROUNDRECT_TEXT_BOUNDS_DIAGNOSIS.md "Diagnosis"
	
[767]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/geometry.js "Geometry"
	
[768]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/mobile-products.js "Mobile"
	
[769]: https://github.com/9627997/pechataet-maksim-site/blob/main/.github/workflows/deploy.yml "Deploy"
	
[770]: https://github.com/9627997/pechataet-maksim-site/blob/main/.github/workflows/ci.yml "CI"
	
[771]: https://github.com/9627997/pechataet-maksim-site/blob/main/package.json "Package"
	
[772]: https://github.com/9627997/pechataet-maksim-site/blob/main/README.md "README"
	
[773]: https://github.com/9627997/pechataet-maksim-site "Repo"
	
[774]: https://github.com/9627997/pechataet-maksim-site/actions "Actions"
	
[775]: https://github.com/9627997/pechataet-maksim-site/tags "Tags"
	
[776]: https://github.com/9627997/pechataet-maksim-site/pulls "PRs"
	
[777]: https://github.com/9627997/pechataet-maksim-site/issues "Issues"
	
[778]: https://github.com/9627997/pechataet-maksim-site/security "Security"
	
[779]: https://github.com/9627997/pechataet-maksim-site/pulse "Pulse"
	
[780]: https://github.com/9627997/pechataet-maksim-site/graphs/traffic "Traffic"
	
[781]: https://github.com/9627997/pechataet-maksim-site/network "Network"
	
[782]: https://github.com/9627997/pechataet-maksim-site/tree/main "Main"
	
[783]: https://github.com/9627997/pechataet-maksim-site/blob/main/README.md "README"
	
[784]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/LIVE_UX_AUDIT_2026-08-14.md "Audit"
	
[785]: https://github.com/9627997/pechataet-maksim-site/actions/runs/31795365127 "Deploy"
	
[786]: https://github.com/9627997/pechataet-maksim-site/pull/62 "PR"
	
[787]: https://печатаетмаксим.рф/studio/?product=sticker "Production Studio"
	
[788]: https://github.com/9627997/pechataet-maksim-site/releases/tag/backup-before-vertical-text-scale-clamp-20260814-1112 "Rollback tag"
	
[789]: https://github.com/9627997/pechataet-maksim-site/commit/b5c3e6c "Main merge"
	
[790]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/LIVE_UX_AUDIT_2026-08-14.md "Audit report"
	
[791]: https://github.com/9627997/pechataet-maksim-site/actions/runs/31795365127 "Deployment run"
	
[792]: https://github.com/9627997/pechataet-maksim-site/pull/62/checks "Checks"
	
[793]: https://github.com/9627997/pechataet-maksim-site/blob/main/tests/studio-production.spec.js "Regression suite"
	
[794]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/layout.js "Layout geometry"
	
[795]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/index.html "Studio UI"
	
[796]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/app.js "Studio controller"
	
[797]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/ROUNDRECT_TEXT_BOUNDS_DIAGNOSIS.md "Technical diagnosis"
	
[798]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/geometry.js "Geometry helper"
	
[799]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/mobile-products.js "Mobile flow"
	
[800]: https://github.com/9627997/pechataet-maksim-site/blob/main/.github/workflows/deploy.yml "Deployment workflow"
	
[801]: https://github.com/9627997/pechataet-maksim-site/blob/main/.github/workflows/ci.yml "CI workflow"
	
[802]: https://github.com/9627997/pechataet-maksim-site/blob/main/package.json "Project scripts"
	
[803]: https://github.com/9627997/pechataet-maksim-site/blob/main/README.md "Project README"
	
[804]: https://github.com/9627997/pechataet-maksim-site "GitHub repository"
	
[805]: https://github.com/9627997/pechataet-maksim-site/actions "Actions"
	
[806]: https://github.com/9627997/pechataet-maksim-site/tags "Repository tags"
	
[807]: https://github.com/9627997/pechataet-maksim-site/pulls "Pull requests"
	
[808]: https://github.com/9627997/pechataet-maksim-site/issues "Issues"
	
[809]: https://github.com/9627997/pechataet-maksim-site/security "Security"
	
[810]: https://github.com/9627997/pechataet-maksim-site/pulse "Repository pulse"
	
[811]: https://github.com/9627997/pechataet-maksim-site/graphs/traffic "Traffic"
	
[812]: https://github.com/9627997/pechataet-maksim-site/network "Network"
	
[813]: https://github.com/9627997/pechataet-maksim-site/tree/main "Main tree"
	
[814]: https://github.com/9627997/pechataet-maksim-site/blob/main/README.md "README"
	
[815]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/LIVE_UX_AUDIT_2026-08-14.md "Audit"
	
[816]: https://github.com/9627997/pechataet-maksim-site/actions/runs/31795365127 "Deployment"
	
[817]: https://github.com/9627997/pechataet-maksim-site/pull/62 "PR 62"
	
[818]: https://печатаетмаксим.рф/studio/?product=sticker "Production Studio"
	
[819]: https://github.com/9627997/pechataet-maksim-site/releases/tag/backup-before-vertical-text-scale-clamp-20260814-1112 "Backup"
	
[820]: https://github.com/9627997/pechataet-maksim-site/commit/b5c3e6c "Main commit"
	
[821]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/LIVE_UX_AUDIT_2026-08-14.md "Report"
	
[822]: https://github.com/9627997/pechataet-maksim-site/actions/runs/31795365127 "Deploy run"
	
[823]: https://github.com/9627997/pechataet-maksim-site/pull/62/checks "Checks"
	
[824]: https://github.com/9627997/pechataet-maksim-site/blob/main/tests/studio-production.spec.js "Suite"
	
[825]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/layout.js "Layout"
	
[826]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/index.html "UI"
	
[827]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/app.js "App"
	
[828]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/ROUNDRECT_TEXT_BOUNDS_DIAGNOSIS.md "Diagnosis"
	
[829]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/geometry.js "Geometry"
	
[830]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/mobile-products.js "Mobile"
	
[831]: https://github.com/9627997/pechataet-maksim-site/blob/main/.github/workflows/deploy.yml "Deploy"
	
[832]: https://github.com/9627997/pechataet-maksim-site/blob/main/.github/workflows/ci.yml "CI"
	
[833]: https://github.com/9627997/pechataet-maksim-site/blob/main/package.json "Package"
	
[834]: https://github.com/9627997/pechataet-maksim-site/blob/main/README.md "README"
	
[835]: https://github.com/9627997/pechataet-maksim-site "Repo"
	
[836]: https://github.com/9627997/pechataet-maksim-site/actions "Actions"
	
[837]: https://github.com/9627997/pechataet-maksim-site/tags "Tags"
	
[838]: https://github.com/9627997/pechataet-maksim-site/pulls "PRs"
	
[839]: https://github.com/9627997/pechataet-maksim-site/issues "Issues"
	
[840]: https://github.com/9627997/pechataet-maksim-site/security "Security"
	
[841]: https://github.com/9627997/pechataet-maksim-site/pulse "Pulse"
	
[842]: https://github.com/9627997/pechataet-maksim-site/graphs/traffic "Traffic"
	
[843]: https://github.com/9627997/pechataet-maksim-site/network "Network"
	
[844]: https://github.com/9627997/pechataet-maksim-site/tree/main "Main"
	
[845]: https://github.com/9627997/pechataet-maksim-site/blob/main/README.md "README"
	
[846]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/LIVE_UX_AUDIT_2026-08-14.md "Audit"
	
[847]: https://github.com/9627997/pechataet-maksim-site/actions/runs/31795365127 "Deploy"
	
[848]: https://github.com/9627997/pechataet-maksim-site/pull/62 "PR"
	
[849]: https://печатаетмаксим.рф/studio/?product=sticker "Production"
	
[850]: https://github.com/9627997/pechataet-maksim-site/releases/tag/backup-before-vertical-text-scale-clamp-20260814-1112 "Backup"
	
[851]: https://github.com/9627997/pechataet-maksim-site/commit/b5c3e6c "Main"
	
[852]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/LIVE_UX_AUDIT_2026-08-14.md "Audit"
	
[853]: https://github.com/9627997/pechataet-maksim-site/actions/runs/31795365127 "Deploy"
	
[854]: https://github.com/9627997/pechataet-maksim-site/pull/62/checks "Checks"
	
[855]: https://github.com/9627997/pechataet-maksim-site/blob/main/tests/studio-production.spec.js "Test"
	
[856]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/layout.js "Layout"
	
[857]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/index.html "Index"
	
[858]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/app.js "App"
	
[859]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/ROUNDRECT_TEXT_BOUNDS_DIAGNOSIS.md "Diagnosis"
	
[860]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/geometry.js "Geometry"
	
[861]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/mobile-products.js "Mobile"
	
[862]: https://github.com/9627997/pechataet-maksim-site/blob/main/.github/workflows/deploy.yml "Deploy"
	
[863]: https://github.com/9627997/pechataet-maksim-site/blob/main/.github/workflows/ci.yml "CI"
	
[864]: https://github.com/9627997/pechataet-maksim-site/blob/main/package.json "Package"
	
[865]: https://github.com/9627997/pechataet-maksim-site/blob/main/README.md "README"
	
[866]: https://github.com/9627997/pechataet-maksim-site "Repo"
	
[867]: https://github.com/9627997/pechataet-maksim-site/actions "Actions"
	
[868]: https://github.com/9627997/pechataet-maksim-site/tags "Tags"
	
[869]: https://github.com/9627997/pechataet-maksim-site/pulls "PR"
	
[870]: https://github.com/9627997/pechataet-maksim-site/issues "Issues"
	
[871]: https://github.com/9627997/pechataet-maksim-site/security "Security"
	
[872]: https://github.com/9627997/pechataet-maksim-site/pulse "Pulse"
	
[873]: https://github.com/9627997/pechataet-maksim-site/graphs/traffic "Traffic"
	
[874]: https://github.com/9627997/pechataet-maksim-site/network "Network"
	
[875]: https://github.com/9627997/pechataet-maksim-site/tree/main "Main"
	
[876]: https://github.com/9627997/pechataet-maksim-site/blob/main/README.md "README"
	
[877]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/LIVE_UX_AUDIT_2026-08-14.md "Audit"
	
[878]: https://github.com/9627997/pechataet-maksim-site/actions/runs/31795365127 "Deploy"
	
[879]: https://github.com/9627997/pechataet-maksim-site/pull/62 "PR"
	
[880]: https://печатаетмаксим.рф/studio/?product=sticker "Live Studio"
	
[881]: https://github.com/9627997/pechataet-maksim-site/releases/tag/backup-before-vertical-text-scale-clamp-20260814-1112 "Rollback"
	
[882]: https://github.com/9627997/pechataet-maksim-site/commit/b5c3e6c "Merge commit"
	
[883]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/LIVE_UX_AUDIT_2026-08-14.md "Audit report"
	
[884]: https://github.com/9627997/pechataet-maksim-site/actions/runs/31795365127 "Production run"
	
[885]: https://github.com/9627997/pechataet-maksim-site/pull/62/checks "Checks"
	
[886]: https://github.com/9627997/pechataet-maksim-site/blob/main/tests/studio-production.spec.js "Regression tests"
	
[887]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/layout.js "Layout JS"
	
[888]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/index.html "Studio HTML"
	
[889]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/app.js "Studio JS"
	
[890]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/ROUNDRECT_TEXT_BOUNDS_DIAGNOSIS.md "Diagnostics"
	
[891]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/geometry.js "Geometry JS"
	
[892]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/mobile-products.js "Mobile JS"
	
[893]: https://github.com/9627997/pechataet-maksim-site/blob/main/.github/workflows/deploy.yml "Deploy config"
	
[894]: https://github.com/9627997/pechataet-maksim-site/blob/main/.github/workflows/ci.yml "CI config"
	
[895]: https://github.com/9627997/pechataet-maksim-site/blob/main/package.json "Package scripts"
	
[896]: https://github.com/9627997/pechataet-maksim-site/blob/main/README.md "README"
	
[897]: https://github.com/9627997/pechataet-maksim-site "GitHub repo"
	
[898]: https://github.com/9627997/pechataet-maksim-site/actions "Actions"
	
[899]: https://github.com/9627997/pechataet-maksim-site/tags "Tags"
	
[900]: https://github.com/9627997/pechataet-maksim-site/pulls "PRs"
	
[901]: https://github.com/9627997/pechataet-maksim-site/issues "Issues"
	
[902]: https://github.com/9627997/pechataet-maksim-site/security "Security"
	
[903]: https://github.com/9627997/pechataet-maksim-site/pulse "Pulse"
	
[904]: https://github.com/9627997/pechataet-maksim-site/graphs/traffic "Traffic"
	
[905]: https://github.com/9627997/pechataet-maksim-site/network "Network"
	
[906]: https://github.com/9627997/pechataet-maksim-site/tree/main "Main"
	
[907]: https://github.com/9627997/pechataet-maksim-site/blob/main/README.md "README"
	
[908]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/LIVE_UX_AUDIT_2026-08-14.md "Audit"
	
[909]: https://github.com/9627997/pechataet-maksim-site/actions/runs/31795365127 "Deploy"
	
[910]: https://github.com/9627997/pechataet-maksim-site/pull/62 "PR"
	
[911]: https://печатаетмаксим.рф/studio/?product=sticker "Studio"
	
[912]: https://github.com/9627997/pechataet-maksim-site/releases/tag/backup-before-vertical-text-scale-clamp-20260814-1112 "Backup"
	
[913]: https://github.com/9627997/pechataet-maksim-site/commit/b5c3e6c "Main"
	
[914]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/LIVE_UX_AUDIT_2026-08-14.md "Live audit"
	
[915]: https://github.com/9627997/pechataet-maksim-site/actions/runs/31795365127 "Deploy"
	
[916]: https://github.com/9627997/pechataet-maksim-site/pull/62/checks "Checks"
	
[917]: https://github.com/9627997/pechataet-maksim-site/blob/main/tests/studio-production.spec.js "Regression"
	
[918]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/layout.js "Layout"
	
[919]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/index.html "Studio HTML"
	
[920]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/app.js "App"
	
[921]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/ROUNDRECT_TEXT_BOUNDS_DIAGNOSIS.md "Diagnosis"
	
[922]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/geometry.js "Geometry"
	
[923]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/mobile-products.js "Mobile"
	
[924]: https://github.com/9627997/pechataet-maksim-site/blob/main/.github/workflows/deploy.yml "Deploy"
	
[925]: https://github.com/9627997/pechataet-maksim-site/blob/main/.github/workflows/ci.yml "CI"
	
[926]: https://github.com/9627997/pechataet-maksim-site/blob/main/package.json "Package"
	
[927]: https://github.com/9627997/pechataet-maksim-site/blob/main/README.md "README"
	
[928]: https://github.com/9627997/pechataet-maksim-site "Repository"
	
[929]: https://github.com/9627997/pechataet-maksim-site/actions "Actions"
	
[930]: https://github.com/9627997/pechataet-maksim-site/tags "Tags"
	
[931]: https://github.com/9627997/pechataet-maksim-site/pulls "Pulls"
	
[932]: https://github.com/9627997/pechataet-maksim-site/issues "Issues"
	
[933]: https://github.com/9627997/pechataet-maksim-site/security "Security"
	
[934]: https://github.com/9627997/pechataet-maksim-site/pulse "Pulse"
	
[935]: https://github.com/9627997/pechataet-maksim-site/graphs/traffic "Traffic"
	
[936]: https://github.com/9627997/pechataet-maksim-site/network "Network"
	
[937]: https://github.com/9627997/pechataet-maksim-site/tree/main "Main"
	
[938]: https://github.com/9627997/pechataet-maksim-site/blob/main/README.md "README"
	
[939]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/LIVE_UX_AUDIT_2026-08-14.md "Audit"
	
[940]: https://github.com/9627997/pechataet-maksim-site/actions/runs/31795365127 "Deploy"
	
[941]: https://github.com/9627997/pechataet-maksim-site/pull/62 "PR"
	
[942]: https://печатаетмаксим.рф/studio/?product=sticker "Production Studio"
	
[943]: https://github.com/9627997/pechataet-maksim-site/releases/tag/backup-before-vertical-text-scale-clamp-20260814-1112 "Backup"
	
[944]: https://github.com/9627997/pechataet-maksim-site/commit/b5c3e6c "Main commit"
	
[945]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/LIVE_UX_AUDIT_2026-08-14.md "Audit"
	
[946]: https://github.com/9627997/pechataet-maksim-site/actions/runs/31795365127 "Deploy"
	
[947]: https://github.com/9627997/pechataet-maksim-site/pull/62/checks "Checks"
	
[948]: https://github.com/9627997/pechataet-maksim-site/blob/main/tests/studio-production.spec.js "Test"
	
[949]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/layout.js "Layout"
	
[950]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/index.html "Index"
	
[951]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/app.js "App"
	
[952]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/ROUNDRECT_TEXT_BOUNDS_DIAGNOSIS.md "Diagnosis"
	
[953]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/geometry.js "Geometry"
	
[954]: https://github.com/9627997/pechataet-maksim-site/blob/main/studio/assets/js/mobile-products.js "Mobile"
	
[955]: https://github.com/9627997/pechataet-maksim-site/blob/main/.github/workflows/deploy.yml "Deploy"
	
[956]: https://github.com/9627997/pechataet-maksim-site/blob/main/.github/workflows/ci.yml "CI"
	
[957]: https://github.com/9627997/pechataet-maksim-site/blob/main/package.json "Package"
	
[958]: https://github.com/9627997/pechataet-maksim-site/blob/main/README.md "README"
	
[959]: https://github.com/9627997/pechataet-maksim-site "Repo"
	
[960]: https://github.com/9627997/pechataet-maksim-site/actions "Actions"
	
[961]: https://github.com/9627997/pechataet-maksim-site/tags "Tags"
	
[962]: https://github.com/9627997/pechataet-maksim-site/pulls "Pulls"
	
[963]: https://github.com/9627997/pechataet-maksim-site/issues "Issues"
	
[964]: https://github.com/9627997/pechataet-maksim-site/security "Security"
	
[965]: https://github.com/9627997/pechataet-maksim-site/pulse "Pulse"
	
[966]: https://github.com/9627997/pechataet-maksim-site/graphs/traffic "Traffic"
	
[967]: https://github.com/9627997/pechataet-maksim-site/network "Network"
	
[968]: https://github.com/9627997/pechataet-maksim-site/tree/main "Main"
	
[969]: https://github.com/9627997/pechataet-maksim-site/blob/main/README.md "README"
	
[970]: https://github.com/9627997/pechataet-maksim-site/blob/main/docs/LIVE_UX_AUDIT_2026-08-14.md "Audit"
	
[971]: https://github.com/9627997/pechataet-maksim-site/actions/runs/31795365127 "Deploy"
	
[972]: https://github.com/9627997/pechataet-maksim-site/pull/62 "PR"
	
[973]: https://печатаетмаксим.рф/studio/?product=sticker "Live Studio"
	
[974]: https://github.com/9627997/pechataet-maksim-site/releases/tag/backup-before-vertical-text-scale-clamp-


## Follow-up live verification after PR #63

The exact plain production URL from the screenshot, https://печатаетмаксим.рф/studio/, now renders only the Product-First chooser «Что создаём?» with two cards: «Ленту» and «Стикер». It no longer renders the legacy combined ribbon + sticker workspace.

After selecting «Стикер», the production UI shows `Надпись на стикере`, a sticker-only preview, and no ribbon workspace. After selecting «Прямоугольный · 80 × 20 мм · радиус 2 мм», the settings show `Масштаб текста по вертикали`; the live slider was at 300 and the roundrect preview was active. This confirms that the screenshot was taken on the old plain-route legacy fallback, not on the intended separate sticker editor.

The corrected production route remains:

- Plain entry: https://печатаетмаксим.рф/studio/ — chooser.
- Direct ribbon editor: https://печатаетмаксим.рф/studio/?product=ribbon
- Direct sticker editor: https://печатаетмаксим.рф/studio/?product=sticker
- Explicit combined/set compatibility route: https://печатаетмаксим.рф/studio/?product=set

PR #63 was merged and the subsequent `Deploy to REG.RU` workflow completed successfully.
