# Templates - Index

Copy-and-edit starter files for every entity type in your myPKA. Each template carries a complete frontmatter block (per [[GL-002-frontmatter-conventions]]) plus a body skeleton with prompt-style headings.

## How to use a template

Pick the template for the entity you are creating. Copy it to the right folder under `PKM/`. Rename it to a kebab-case slug per [[GL-001-file-naming-conventions]]. Fill in the fields you have. Leave the rest blank or delete the lines you will never use.

Example, from your myPKA root:

```bash
cp "Team Knowledge/Templates/person.md" "PKM/CRM/People/jane-doe.md"
```

Then open the new file and edit. The Properties tab in mypka-interface will populate as soon as you save the file with frontmatter that has values.

## Templates

| Template | Entity | Goes under |
|---|---|---|
| [[Templates/person]] | Person | `PKM/CRM/People/<slug>.md` |
| [[Templates/organization]] | Organization | `PKM/CRM/Organizations/<slug>.md` |
| [[Templates/project]] | Project | `PKM/My Life/Projects/<slug>.md` |
| [[Templates/goal]] | Goal | `PKM/My Life/Goals/<slug>.md` |
| [[Templates/habit]] | Habit | `PKM/My Life/Habits/<slug>.md` |
| [[Templates/topic]] | Topic | `PKM/My Life/Topics/<slug>.md` |
| [[Templates/key-element]] | Key Element | `PKM/My Life/Key Elements/<slug>.md` |
| [[Templates/document]] | Document | `PKM/Documents/<slug>.md` |

### Client Delivery templates

Structurally separate from the eight PKM templates above — these back `Client Delivery/`, Warden's business/client-delivery root, per [[GL-006-client-delivery-frontmatter-conventions]] rather than GL-002.

| Template | Entity | Goes under |
|---|---|---|
| [[Templates/engagement]] | Engagement | `Client Delivery/<engagement-slug>/Project Control/<engagement-slug>.md` |
| [[Templates/work-package]] | Work Package | `Client Delivery/<engagement-slug>/Work Packages/<engagement-slug>-wp-<NNN>-<slug>.md` |
| [[Templates/register-item]] | Register Item (risk/issue/change/decision) | `Client Delivery/<engagement-slug>/Risk-Issue-Change-Decision Register/<engagement-slug>-reg-<NNN>.md` |

## Rules these templates follow

- Frontmatter field names match the SQLite column names in [[SOP-002-convert-mypka-to-sqlite]] for the eight PKM templates. The three Client Delivery templates are not (yet) part of the SQLite mirror — see [[GL-006-client-delivery-frontmatter-conventions]] §"Does this feed the SQLite mirror?".
- Required fields are marked in [[GL-002-frontmatter-conventions]] (PKM templates) or [[GL-006-client-delivery-frontmatter-conventions]] (Client Delivery templates). Everything else is optional - delete the lines you do not need.
- Body H2 headings are suggestions, not contracts. Add or remove sections as your note evolves. The Properties tab does not care what is in the body.
- Foreign-key fields (e.g. `company`, `key_element`, `engagement`, `linked_*`) store the **slug** of the target file, not the title. Per [[GL-002-frontmatter-conventions]] rule 4 (inherited by GL-006 for Client Delivery entities).

## When in doubt

Read [[GL-002-frontmatter-conventions]] for PKM entities, or [[GL-006-client-delivery-frontmatter-conventions]] for `Client Delivery/` entities. If a field you need is not there, edit the matching Guideline first, then come back and use it.
