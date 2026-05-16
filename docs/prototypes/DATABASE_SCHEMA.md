# DENTALLEARN V3 — DATABASE SCHEMA
## Récupéré depuis Supabase le 5 avril 2026, mis à jour le 3 mai 2026 (post-Sprint 1)
## Project ID : dxybsuhfkwuemapqrvgz

---

## TABLES (54 tables)

> Ce document détaille les 38 tables historiques + les 4 tables ajoutées par
> Sprint 1 (T1 : `user_roles`, `organizations`, `organization_members` ; T6 :
> `org_curated_formations`). Les 12 tables `news_*` / `complaints` / `user_attestations` /
> `user_attestation_verifications` ajoutées par les batchs précédents (Tickets 1→8 News
> et Attestations) sont listées sans détail colonne — leur schéma est consultable
> via le MCP Supabase (`list_tables verbose=true`).

---

### cabinet_compliance_categories
| Colonne | Type | Nullable | Défaut |
|---------|------|----------|--------|
| id | uuid | NO | gen_random_uuid() |
| code | varchar(50) | NO | |
| name | varchar(100) | NO | |
| description | text | YES | |
| icon | varchar(50) | YES | |
| color | varchar(20) | YES | |
| display_order | integer | YES | 0 |
| created_at | timestamptz | YES | now() |

---

### cabinet_compliance_items
| Colonne | Type | Nullable | Défaut |
|---------|------|----------|--------|
| id | uuid | NO | gen_random_uuid() |
| category_id | uuid | NO | |
| code | varchar(50) | NO | |
| title | varchar(255) | NO | |
| description | text | YES | |
| frequency | varchar(50) | YES | |
| is_mandatory | boolean | YES | true |
| reference_text | text | YES | |
| help_url | text | YES | |
| display_order | integer | YES | 0 |
| created_at | timestamptz | YES | now() |

---

### content_library
| Colonne | Type | Nullable | Défaut |
|---------|------|----------|--------|
| id | uuid | NO | gen_random_uuid() |
| axe_id | integer | NO | |
| content_type | varchar(50) | NO | |
| category | varchar(100) | NO | |
| title | varchar(255) | NO | |
| description | text | YES | |
| thumbnail_url | text | YES | |
| content_url | text | YES | |
| duration_minutes | integer | YES | |
| is_shareable | boolean | YES | false |
| access_level | varchar(20) | YES | 'free' |
| tags | ARRAY | YES | |
| view_count | integer | YES | 0 |
| is_published | boolean | YES | true |
| display_order | integer | YES | 0 |
| created_at | timestamptz | YES | now() |
| updated_at | timestamptz | YES | now() |

---

### course_watch_logs
| Colonne | Type | Nullable | Défaut |
|---------|------|----------|--------|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | NO | |
| sequence_id | uuid | NO | |
| started_at | timestamptz | NO | |
| ended_at | timestamptz | YES | |
| total_duration_seconds | integer | YES | |
| watched_percent | integer | YES | 0 |
| pause_count | integer | YES | 0 |
| playback_events | jsonb | YES | |
| completed | boolean | YES | false |
| created_at | timestamptz | YES | now() |

---

### cp_actions
| Colonne | Type | Nullable | Défaut |
|---------|------|----------|--------|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | NO | |
| axe_id | integer | NO | |
| action_type | USER-DEFINED | NO | |
| title | varchar(255) | NO | |
| description | text | YES | |
| provider | varchar(255) | YES | |
| validation_date | date | NO | |
| start_date | date | YES | |
| end_date | date | YES | |
| hours | numeric | YES | |
| formation_id | uuid | YES | |
| user_formation_id | uuid | YES | |
| proof_url | text | YES | |
| proof_filename | varchar(255) | YES | |
| reference_number | varchar(100) | YES | |
| is_verified | boolean | YES | false |
| verified_at | timestamptz | YES | |
| verified_by | varchar(50) | YES | |
| notes | text | YES | |
| is_external | boolean | YES | false |
| source | varchar(50) | YES | 'manual' |
| created_at | timestamptz | YES | now() |
| updated_at | timestamptz | YES | now() |

---

### cp_axes
| Colonne | Type | Nullable | Défaut |
|---------|------|----------|--------|
| id | integer | NO | |
| code | varchar(20) | NO | |
| name | varchar(100) | NO | |
| short_name | varchar(30) | NO | |
| description | text | YES | |
| color | varchar(7) | NO | |
| required_actions | integer | YES | 2 |
| icon | varchar(50) | YES | |
| display_order | integer | YES | 1 |
| created_at | timestamptz | YES | now() |

---

### cp_user_settings
| Colonne | Type | Nullable | Défaut |
|---------|------|----------|--------|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | NO | |
| installation_date | date | YES | |
| cp_start_date | date | NO | |
| cp_duration_years | integer | NO | |
| cp_end_date | date | NO | |
| show_radar_on_dashboard | boolean | YES | true |
| notifications_enabled | boolean | YES | true |
| alert_months_before | integer | YES | 18 |
| macertifpro_linked | boolean | YES | false |
| macertifpro_last_sync | timestamptz | YES | |
| created_at | timestamptz | YES | now() |
| updated_at | timestamptz | YES | now() |

---

### daily_axis_progress
| Colonne | Type | Nullable | Défaut |
|---------|------|----------|--------|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | NO | |
| axe_id | integer | NO | |
| progress_date | date | NO | CURRENT_DATE |
| points_earned | integer | YES | 0 |
| quizzes_completed | integer | YES | 0 |
| formations_progress | integer | YES | 0 |
| actions_count | integer | YES | 0 |
| created_at | timestamptz | YES | now() |
| updated_at | timestamptz | YES | now() |

---

### daily_axis_quizzes
| Colonne | Type | Nullable | Défaut |
|---------|------|----------|--------|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | NO | |
| axe_id | integer | NO | |
| quiz_date | date | NO | CURRENT_DATE |
| questions_ids | ARRAY | NO | |
| answers | jsonb | YES | |
| score | integer | YES | 0 |
| max_score | integer | YES | 4 |
| started_at | timestamptz | YES | |
| completed_at | timestamptz | YES | |
| time_spent_seconds | integer | YES | |
| created_at | timestamptz | YES | now() |

---

### daily_quiz_results
| Colonne | Type | Nullable | Défaut |
|---------|------|----------|--------|
| id | uuid | NO | uuid_generate_v4() |
| user_id | uuid | NO | |
| quiz_date | date | NO | CURRENT_DATE |
| score | integer | NO | 0 |
| total_questions | integer | NO | 10 |
| total_points | integer | NO | 0 |
| question_ids | ARRAY | YES | '{}' |
| completed_at | timestamptz | YES | |
| created_at | timestamptz | YES | now() |

---

### epp_audits
| Colonne | Type | Nullable | Défaut |
|---------|------|----------|--------|
| id | uuid | NO | gen_random_uuid() |
| title | text | NO | |
| slug | text | NO | |
| description | text | YES | |
| formation_id | uuid | YES | |
| nb_dossiers_min | integer | NO | 10 |
| nb_dossiers_max | integer | NO | 20 |
| delai_t2_mois_min | integer | NO | 2 |
| delai_t2_mois_max | integer | NO | 6 |
| is_published | boolean | NO | false |
| created_at | timestamptz | YES | now() |
| updated_at | timestamptz | YES | now() |
| theme_slug | text | YES | |
| inclusion_criteria | jsonb | YES | '[]' |
| exclusion_criteria | jsonb | YES | '[]' |

---

### epp_criteria
| Colonne | Type | Nullable | Défaut |
|---------|------|----------|--------|
| id | uuid | NO | gen_random_uuid() |
| audit_id | uuid | NO | |
| sort_order | integer | NO | 0 |
| code | text | NO | |
| type | text | NO | |
| label | text | NO | |
| source | text | YES | |
| created_at | timestamptz | YES | now() |

---

### epp_improvement_suggestions
| Colonne | Type | Nullable | Défaut |
|---------|------|----------|--------|
| id | uuid | NO | gen_random_uuid() |
| criterion_id | uuid | NO | |
| sort_order | integer | NO | 0 |
| text | text | NO | |
| sequence_ref | text | YES | |
| created_at | timestamptz | YES | now() |

---

### formation_likes
| Colonne | Type | Nullable | Défaut |
|---------|------|----------|--------|
| id | uuid | NO | uuid_generate_v4() |
| user_id | uuid | NO | |
| formation_id | uuid | NO | |
| created_at | timestamptz | YES | now() |

---

### formations
| Colonne | Type | Nullable | Défaut |
|---------|------|----------|--------|
| id | uuid | NO | uuid_generate_v4() |
| title | varchar(255) | NO | |
| slug | varchar(255) | NO | |
| instructor_name | varchar(100) | NO | |
| description_short | text | YES | |
| description_long | text | YES | |
| cover_image_url | text | YES | |
| category | varchar(50) | YES | |
| level | varchar(20) | YES | 'intermediate' |
| total_sequences | integer | YES | 15 |
| dpc_hours | numeric | YES | |
| is_published | boolean | YES | false |
| created_at | timestamptz | YES | now() |
| updated_at | timestamptz | YES | now() |
| access_type | varchar(20) | YES | **'demo'** |
| cp_eligible | boolean | YES | false |
| cp_axe_id | integer | YES | |
| cp_hours | numeric | YES | |
| likes_count | integer | YES | 0 |
| axe_cp | integer | YES | |
| owner_org_id | uuid | YES | | FK → organizations.id ON DELETE RESTRICT. NULL = catalogue Dentalschool public, NOT NULL = formation owned par un tenant (cf. Sprint 1 T3) |

> ⚠️ **`access_type = 'demo'`** par défaut → déclenche le mode Preview dans le frontend et désactive la sauvegarde de progression. Mettre à `'full'` pour activer.

Index : `formations_owner_org_id_idx` sur `(owner_org_id)` (Sprint 1 T3).

---

### generated_documents
| Colonne | Type | Nullable | Défaut |
|---------|------|----------|--------|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | NO | |
| document_type | varchar(50) | NO | |
| title | varchar(255) | NO | |
| file_url | text | YES | |
| file_size_bytes | integer | YES | |
| generation_data | jsonb | YES | |
| status | varchar(20) | YES | 'draft' |
| valid_until | date | YES | |
| created_at | timestamptz | YES | now() |
| updated_at | timestamptz | YES | now() |

---

### leaderboard_rewards
| Colonne | Type | Nullable | Défaut |
|---------|------|----------|--------|
| id | uuid | NO | uuid_generate_v4() |
| position_min | integer | NO | |
| position_max | integer | NO | |
| bonus_points | integer | NO | 0 |
| created_at | timestamptz | YES | now() |

---

### news_articles
| Colonne | Type | Nullable | Défaut |
|---------|------|----------|--------|
| id | uuid | NO | gen_random_uuid() |
| category | varchar(20) | NO | |
| title | varchar(255) | NO | |
| summary | text | YES | |
| source | varchar(100) | YES | |
| external_url | text | YES | |
| image_url | text | YES | |
| is_external | boolean | YES | false |
| published_at | timestamptz | YES | now() |
| is_published | boolean | YES | true |
| view_count | integer | YES | 0 |
| created_at | timestamptz | YES | now() |

---

### notifications
| Colonne | Type | Nullable | Défaut |
|---------|------|----------|--------|
| id | uuid | NO | uuid_generate_v4() |
| user_id | uuid | YES | |
| type | USER-DEFINED | NO | |
| title | varchar(255) | YES | |
| message | text | NO | |
| status | USER-DEFINED | YES | 'pending' |
| sent_at | timestamptz | YES | |
| read_at | timestamptz | YES | |
| created_at | timestamptz | YES | now() |

---

### profiles
| Colonne | Type | Nullable | Défaut |
|---------|------|----------|--------|
| id | uuid | NO | |
| email | text | YES | |
| full_name | text | YES | |
| role | text | YES | 'user' |
| created_at | timestamptz | YES | now() |
| updated_at | timestamptz | YES | now() |

---

### push_subscriptions
| Colonne | Type | Nullable | Défaut |
|---------|------|----------|--------|
| id | uuid | NO | uuid_generate_v4() |
| user_id | uuid | YES | |
| endpoint | text | NO | |
| p256dh | text | NO | |
| auth | text | NO | |
| user_agent | text | YES | |
| created_at | timestamptz | YES | now() |
| updated_at | timestamptz | YES | now() |

---

### questions
| Colonne | Type | Nullable | Défaut |
|---------|------|----------|--------|
| id | uuid | NO | uuid_generate_v4() |
| sequence_id | uuid | YES | |
| question_order | integer | NO | |
| question_type | varchar(20) | NO | |
| question_text | text | NO | |
| options | jsonb | NO | |
| feedback_correct | text | NO | |
| feedback_incorrect | text | NO | |
| image_url | text | YES | |
| points | integer | YES | 10 |
| recommended_time_seconds | integer | YES | 60 |
| created_at | timestamptz | YES | now() |
| is_daily_quiz_eligible | boolean | YES | true |
| difficulty | integer | YES | 1 |

---

### quests
| Colonne | Type | Nullable | Défaut |
|---------|------|----------|--------|
| id | uuid | NO | uuid_generate_v4() |
| quest_type | varchar | NO | |
| category | varchar | NO | |
| name | varchar | NO | |
| description | text | NO | |
| condition_type | varchar | NO | |
| condition_value | integer | NO | |
| condition_extra | jsonb | YES | |
| reward_points | integer | NO | |
| difficulty | integer | YES | 1 |
| is_active | boolean | YES | true |
| created_at | timestamptz | YES | now() |
| cooldown_type | varchar | YES | 'daily' |
| icon | varchar | YES | '🎯' |
| gradient_from | varchar | YES | '#6366F1' |
| gradient_to | varchar | YES | '#8B5CF6' |

---

### sequences
| Colonne | Type | Nullable | Défaut |
|---------|------|----------|--------|
| id | uuid | NO | uuid_generate_v4() |
| formation_id | uuid | YES | |
| sequence_number | integer | NO | |
| title | varchar(255) | NO | |
| unlock_day | integer | YES | |
| estimated_duration_minutes | integer | YES | 3 |
| learning_objectives | jsonb | YES | |
| created_at | timestamptz | YES | now() |
| updated_at | timestamptz | YES | now() |
| is_intro | boolean | YES | false |
| is_evaluation | boolean | YES | false |
| access_level | varchar(20) | YES | 'premium' |
| course_media_url | text | YES | |
| course_media_type | varchar(10) | YES | |
| course_duration_seconds | integer | YES | |
| subtitles_url | text | YES | |
| infographic_url | text | YES | |
| timeline_url | text | YES | |
| timeline_published | boolean | NO | false |

> POC visualisation audio (T1, mai 2026) : `timeline_url` pointe vers le JSON
> `timeline.json` du bucket `audio-timelines` (transcript karaoké + scènes
> whiteboard). `timeline_published=TRUE` AND `timeline_url IS NOT NULL` → rendu
> enrichi affiché côté user.

---

### streaks
| Colonne | Type | Nullable | Défaut |
|---------|------|----------|--------|
| id | uuid | NO | uuid_generate_v4() |
| user_id | uuid | YES | |
| current_streak | integer | YES | 0 |
| longest_streak | integer | YES | 0 |
| last_activity_date | date | YES | |
| streak_protected_until | timestamptz | YES | |
| created_at | timestamptz | YES | now() |
| updated_at | timestamptz | YES | now() |

---

### user_cabinet_compliance
| Colonne | Type | Nullable | Défaut |
|---------|------|----------|--------|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | NO | |
| item_id | uuid | NO | |
| status | varchar(20) | YES | 'pending' |
| last_check_date | date | YES | |
| next_check_date | date | YES | |
| expiry_date | date | YES | |
| proof_url | text | YES | |
| notes | text | YES | |
| created_at | timestamptz | YES | now() |
| updated_at | timestamptz | YES | now() |

---

### user_epp_responses
| Colonne | Type | Nullable | Défaut |
|---------|------|----------|--------|
| id | uuid | NO | gen_random_uuid() |
| session_id | uuid | NO | |
| dossier_number | integer | NO | |
| criterion_id | uuid | NO | |
| response | text | NO | |
| created_at | timestamptz | YES | now() |

---

### user_epp_sessions
| Colonne | Type | Nullable | Défaut |
|---------|------|----------|--------|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | NO | |
| audit_id | uuid | NO | |
| tour | integer | NO | |
| started_at | timestamptz | YES | now() |
| completed_at | timestamptz | YES | **NULL = en cours** |
| nb_dossiers | integer | YES | |
| score_global | numeric | YES | |
| plan_actions | jsonb | YES | |
| created_at | timestamptz | YES | now() |

---

### user_formations
| Colonne | Type | Nullable | Défaut |
|---------|------|----------|--------|
| id | uuid | NO | uuid_generate_v4() |
| user_id | uuid | YES | |
| formation_id | uuid | YES | |
| started_at | timestamptz | YES | now() |
| completed_at | timestamptz | YES | |
| is_active | boolean | YES | true |
| progress | jsonb | YES | |
| access_type | varchar(20) | YES | **'demo'** |
| current_sequence | integer | YES | 1 |
| total_points | integer | YES | 0 |
| best_score | integer | YES | 0 |

> ⚠️ **`access_type = 'demo'`** par défaut → même problème que `formations.access_type`. La ligne n'est créée que si le code d'inscription s'exécute (désactivé en mode Preview).

---

### user_notification_preferences
| Colonne | Type | Nullable | Défaut |
|---------|------|----------|--------|
| id | uuid | NO | uuid_generate_v4() |
| user_id | uuid | YES | |
| push_enabled | boolean | YES | true |
| leaderboard_results | boolean | YES | true |
| new_sequences | boolean | YES | true |
| daily_reminders | boolean | YES | true |
| reminder_time | time | YES | '09:00:00' |
| created_at | timestamptz | YES | now() |
| updated_at | timestamptz | YES | now() |

---

### user_points
| Colonne | Type | Nullable | Défaut |
|---------|------|----------|--------|
| id | uuid | NO | uuid_generate_v4() |
| user_id | uuid | YES | |
| sequence_id | uuid | YES | |
| points_earned | integer | NO | |
| reason | USER-DEFINED | NO | |
| created_at | timestamptz | YES | now() |

---

### user_profiles
| Colonne | Type | Nullable | Défaut |
|---------|------|----------|--------|
| id | uuid | NO | |
| first_name | varchar(100) | YES | |
| last_name | varchar(100) | YES | |
| profile_photo_url | text | YES | |
| city | varchar(100) | YES | |
| practice_type | varchar(50) | YES | |
| years_experience | integer | YES | |
| created_at | timestamptz | YES | now() |
| updated_at | timestamptz | YES | now() |
| ordre_inscription_date | date | YES | |

---

### user_quest_completions
| Colonne | Type | Nullable | Défaut |
|---------|------|----------|--------|
| id | uuid | NO | uuid_generate_v4() |
| user_id | uuid | NO | |
| quest_id | uuid | NO | |
| completed_at | timestamptz | NO | now() |
| points_awarded | integer | NO | |
| sequence_id | uuid | YES | |

---

### user_quest_history
| Colonne | Type | Nullable | Défaut |
|---------|------|----------|--------|
| id | uuid | NO | uuid_generate_v4() |
| user_id | uuid | NO | |
| date | date | NO | |
| daily_quests_completed | integer | YES | 0 |
| weekly_quests_completed | integer | YES | 0 |
| perfect_day | boolean | YES | false |
| created_at | timestamptz | YES | now() |

---

### user_quests
| Colonne | Type | Nullable | Défaut |
|---------|------|----------|--------|
| id | uuid | NO | uuid_generate_v4() |
| user_id | uuid | NO | |
| quest_id | uuid | NO | |
| assigned_date | date | NO | |
| progress | integer | YES | 0 |
| is_completed | boolean | YES | false |
| completed_at | timestamptz | YES | |
| reward_claimed | boolean | YES | false |
| created_at | timestamptz | YES | now() |

---

### user_sequences
| Colonne | Type | Nullable | Défaut |
|---------|------|----------|--------|
| id | uuid | NO | uuid_generate_v4() |
| user_id | uuid | YES | |
| sequence_id | uuid | YES | |
| completed_at | timestamptz | YES | |
| score | integer | YES | |
| time_spent_seconds | integer | YES | |
| attempts_count | integer | YES | 1 |
| answers | jsonb | YES | |

---

### user_subscriptions
| Colonne | Type | Nullable | Défaut |
|---------|------|----------|--------|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | NO | |
| plan | varchar(20) | YES | 'free' |
| status | varchar(20) | YES | 'active' |
| trial_ends_at | timestamptz | YES | |
| current_period_start | timestamptz | YES | |
| current_period_end | timestamptz | YES | |
| stripe_customer_id | varchar(255) | YES | |
| stripe_subscription_id | varchar(255) | YES | |
| created_at | timestamptz | YES | now() |
| updated_at | timestamptz | YES | now() |

---

### weekly_leaderboard
| Colonne | Type | Nullable | Défaut |
|---------|------|----------|--------|
| id | uuid | NO | uuid_generate_v4() |
| user_id | uuid | NO | |
| week_start | date | NO | |
| week_end | date | NO | |
| points_earned | integer | YES | 0 |
| rank | integer | YES | |
| previous_rank | integer | YES | |
| reward_points | integer | YES | 0 |
| rewards_claimed | boolean | YES | false |
| created_at | timestamptz | YES | now() |
| updated_at | timestamptz | YES | now() |

---

## Multi-tenant — Sprint 1 (2 mai 2026)

Migration `20260502_sprint1_rbac_multitenant.sql` — fondations RBAC + multi-tenant.
Référence : `MATRICE_ROLES_DENTALLEARN_V1.md` V1.2.

### Enums

| Enum | Valeurs |
|---|---|
| `app_role` | `super_admin`, `formateur`, `cs_member`, `marketing`, `support`, `user` |
| `org_type` | `cabinet`, `hr_entity`, `training_org` |
| `intra_role` | `titulaire`, `collaborateur`, `assistante`, `admin_rh`, `manager`, `praticien_salarie`, `admin_of`, `formateur_of`, `apprenant_of` |
| `org_plan` | `standard`, `premium` |
| `membership_status` | `active`, `invited`, `revoked` |

### user_roles
**RLS** : activée. Rôles globaux additifs (un user peut cumuler plusieurs rôles).

| Colonne | Type | Nullable | Défaut | Note |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| user_id | uuid | NO | | FK → auth.users.id ON DELETE CASCADE |
| role | app_role | NO | | UNIQUE (user_id, role) |
| created_at | timestamptz | NO | now() | |

Index : `user_roles_user_id_idx` sur `(user_id)`.

### organizations
**RLS** : activée. Tenants clients (cabinets, RH, OF tiers).

| Colonne | Type | Nullable | Défaut | Note |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| name | varchar(200) | NO | | |
| type | org_type | NO | | cabinet / hr_entity / training_org |
| plan | org_plan | NO | standard | standard / premium |
| branding_logo_url | text | YES | | HR/OF uniquement (CHECK `branding_only_for_hr_or_of`) |
| branding_primary_color | varchar(7) | YES | | hex #RRGGBB, HR/OF uniquement |
| qualiopi_number | varchar(20) | YES | | Numéro Qualiopi OF tiers (cf. T7) |
| odpc_number | varchar(10) | YES | | Numéro ODPC OF tiers (cf. T7) |
| owner_user_id | uuid | NO | | FK → auth.users.id (no ON DELETE — bloque la suppression) |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

### organization_members
**RLS** : activée. Appartenance user → org. **1 user = 1 org max en V1** (UNIQUE user_id, décision Q1 matrice §7.1).

| Colonne | Type | Nullable | Défaut | Note |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| user_id | uuid | NO | | FK → auth.users.id ON DELETE CASCADE, **UNIQUE** |
| org_id | uuid | NO | | FK → organizations.id ON DELETE CASCADE |
| intra_role | intra_role | NO | | Validé par trigger `validate_intra_role_matches_org_type` |
| manager_id | uuid | YES | | FK → auth.users.id (hiérarchie HR, no ON DELETE) |
| status | membership_status | NO | invited | active / invited / revoked |
| joined_at | timestamptz | YES | | |
| revoked_at | timestamptz | YES | | Timestamp soft-delete |
| created_at | timestamptz | NO | now() | |

Index : `organization_members_org_id_idx` sur `(org_id)`.

### Trigger `validate_intra_role_matches_org_type`

`BEFORE INSERT OR UPDATE ON organization_members` — valide la cohérence `intra_role` ↔ `organizations.type` (matrice V1.2) :
- `cabinet` : `titulaire`, `collaborateur`, `assistante`
- `hr_entity` : `admin_rh`, `manager`, `praticien_salarie`, `assistante`
- `training_org` : `admin_of`, `formateur_of`, `apprenant_of`, `assistante`

`assistante` est valide dans les 3 types d'org (V1.2 — décision Dr Fantin du 2 mai 2026).

### Helpers SQL

Tous `STABLE SECURITY DEFINER`, `search_path = public, pg_temp`. EXECUTE `REVOKE FROM PUBLIC` + `GRANT TO authenticated, service_role` (anon ne peut pas appeler ces RPC).

| Fonction | Usage |
|---|---|
| `has_role(p_user_id uuid, p_role app_role) → boolean` | Vérifie un rôle global |
| `is_super_admin(p_user_id uuid) → boolean` | Raccourci `has_role(uid, 'super_admin')` |
| `user_org(p_user_id uuid) → uuid` | org_id du user (NULL si orgless / status≠active) |
| `org_can_create_content(p_org_id uuid) → boolean` | Gating D.07 — premium HR/OF uniquement |

### Policies RLS (11 policies)

**user_roles** (4) :
- `user_roles_select_own` : user voit ses propres rôles + super_admin voit tout
- `user_roles_insert_super_admin` / `update_super_admin` / `delete_super_admin`

**organizations** (4) :
- `organizations_select` : super_admin + membres actifs de l'org
- `organizations_insert_super_admin`
- `organizations_update_admins` : super_admin + (titulaire / admin_rh / admin_of) actif
- `organizations_delete_super_admin`

**organization_members** (3) :
- `org_members_select` : super_admin + membres de la même org + ses propres lignes
- `org_members_insert` : super_admin + (titulaire / admin_rh / admin_of) de l'org
- `org_members_update` : idem insert
- **Aucune policy DELETE** — soft-delete via UPDATE `status = 'revoked'`

### Seed initial

`INSERT INTO user_roles (user_id, role) VALUES ('af506ec2-a281-4485-a504-b0633c8d2362', 'super_admin')` — Dr Julie Fantin (drfantin@gmail.com). **Reste orgless en V1** (décision Q2 matrice §7.1).

---

## RLS Multi-tenant — Sprint 1 T3 (2 mai 2026)

Migration `20260502_sprint1_formations_owner_org.sql` — isolation contenu tenant + refonte RLS sur 7 tables.

### Helper SQL `user_can_see_formation`

`STABLE SECURITY DEFINER`, `search_path = public, pg_temp`. `REVOKE FROM PUBLIC` + `GRANT TO authenticated, service_role`.

| Fonction | Usage |
|---|---|
| `user_can_see_formation(p_user_id uuid, p_formation_id uuid) → boolean` | Centralise la règle de visibilité d'une formation : super_admin OR (catalogue Dentalschool publié, `owner_org_id IS NULL AND is_published = true`) OR (formation owned par l'org active du user, `owner_org_id = user_org(p_user_id)`) |

### Policies RLS sur les 7 tables impactées

**formations** : 1 policy SELECT — `formations_select_with_tenant_isolation`
- `is_super_admin(auth.uid()) OR (owner_org_id IS NULL AND is_published = true) OR (owner_org_id IS NOT NULL AND owner_org_id = user_org(auth.uid()))`

**sequences** : 4 policies (refonte complète, suppression UUID hardcodés)
- `sequences_select_with_tenant_isolation` : isolation via la formation parente (`user_can_see_formation`)
- `sequences_insert_super_admin`, `sequences_update_super_admin`, `sequences_delete_super_admin` : remplacent les anciennes policies hardcodées sur l'UUID Dr Fantin par `is_super_admin(auth.uid())`

**questions** : 1 policy SELECT — `questions_select_with_tenant_isolation`
- Questions news (`news_synthesis_id IS NOT NULL`) : toujours publiques (catalogue Dentalschool)
- Questions formation (`sequence_id IS NOT NULL`) : isolation via la séquence + `user_can_see_formation`

**user_formations** : 1 policy SELECT — `user_formations_select`
- `auth.uid() = user_id OR is_super_admin(auth.uid())`
- Doublons FR/EN supprimés. INSERT/UPDATE inchangés (toujours en doublon FR/EN).

**user_sequences** : 1 policy SELECT — `user_sequences_select`
- `auth.uid() = user_id OR is_super_admin(auth.uid())` — idem `user_formations`

**course_watch_logs** : 1 policy SELECT — `course_watch_logs_select`
- `auth.uid() = user_id OR is_super_admin(auth.uid())`
- ⚠️ INSERT et UPDATE policies **strictement intactes** (`auth.uid() = user_id`) — obligation DPC d'immuabilité des logs (aucune policy DELETE par construction).

**epp_audits** : 2 policies (refonte complète, `epp_audits` est un catalogue, pas un journal user)
- `epp_audits_select` : `is_super_admin OR (is_published = true AND (formation_id IS NULL OR user_can_see_formation(auth.uid(), formation_id)))`
- `epp_audits_all_super_admin` : remplace l'ancienne policy ALL hardcodée sur l'UUID Dr Fantin par `is_super_admin(auth.uid())`

### Tests d'isolation validés (snapshot 2 mai 2026)

| # | Test | Résultat attendu | Vérifié |
|---|---|---|---|
| 1 | `user_can_see_formation(dr_fantin, formation_owned)` | true | ✅ |
| 2 | `user_can_see_formation(orgless_inconnu, formation_owned)` | false | ✅ |
| 3 | `user_can_see_formation(orgless, formation_dentalschool)` | true | ✅ |
| 4 | 6 formations Dentalschool intactes (`owner_org_id IS NULL`) | 6 | ✅ |
| 5 | 786 questions news visibles via la nouvelle policy | 786 | ✅ |
| 6 | Dr Fantin voit ses 6 formations Dentalschool | 6/6 | ✅ |
| 7 | `course_watch_logs` policies INSERT/UPDATE inchangées (DPC) | OK | ✅ |

---

## Curation tenant — Sprint 1 T6 (3 mai 2026)

Migration `20260503_sprint1_org_curated_formations.sql` — table de liaison pour
épingler des formations Dentalschool dans le catalogue d'une organisation `hr_entity`
ou `training_org`.

### org_curated_formations
**RLS** : activée. **Aucune policy pour `authenticated`** → toutes les opérations
passent par l'API serveur `/api/tenant/curation` avec `createAdminClient()` (service_role
bypass RLS).

| Colonne | Type | Nullable | Défaut | Note |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | FK → organizations.id ON DELETE CASCADE |
| formation_id | uuid | NO | | FK → formations.id ON DELETE CASCADE |
| display_order | integer | NO | 0 | Ordre d'affichage côté tenant |
| created_at | timestamptz | NO | now() | |

Contrainte : `UNIQUE (org_id, formation_id)`.
Index : `org_curated_formations_org_id_idx`, `org_curated_formations_org_order_idx`.

**Note V1** : la table autorise techniquement n'importe quelle `formation_id` (y compris
une formation owned d'un autre tenant). L'API `/api/tenant/curation` filtre côté
serveur pour ne permettre que des formations Dentalschool publiées (`owner_org_id IS NULL
AND is_published = true`). Ce gating peut être renforcé en DB par un trigger en V1.5.

### Action D.06 livrée
Couvre l'action D.06 « Curer le catalogue Dentalschool » de la matrice V1.2 pour les
sous-rôles `admin_rh` (HR) et `admin_of` (training_org). Cabinet exclu (cf. matrice §4 —
D.06 désactivé en V1).

---

## Trigger signup — Sprint 1 T4 (2 mai 2026)

Migration `20260502_sprint1_handle_new_user.sql` — provisionnement automatique du profil user à l'inscription.

### Fonction `public.handle_new_user()`

`SECURITY DEFINER`, `search_path = public`. À chaque INSERT dans `auth.users`, insère :
- `public.user_profiles (id, first_name, last_name)` depuis `raw_user_meta_data` — `ON CONFLICT (id) DO NOTHING`
- `public.streaks (user_id, current_streak, longest_streak)` avec valeurs `(NEW.id, 0, 0)` — `ON CONFLICT (user_id) DO NOTHING`

Idempotente : un rejeu (ex. ré-inscription après suppression manuelle) ne provoque pas d'erreur.

### Trigger `on_auth_user_created`

`AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user()`.

Conséquence côté code : `src/app/register/page.tsx` ne fait plus d'INSERT manuel sur `user_profiles`/`streaks` — la BDD s'en charge.

---

## Attestations — Organisme dynamique — Sprint 1 T7 (3 mai 2026)

Migration : `supabase/migrations/20260503b_sprint1_attestations_organisme_dynamic.sql`
+ `_down.sql` symétrique.

### Helpers SQL (ajoutés)

Tous `STABLE SECURITY DEFINER` avec `search_path = public, pg_temp`.

#### `attestation_organisme_for(p_user_id uuid, p_formation_id uuid) RETURNS varchar`

Calcule dynamiquement l'organisme délivrant une attestation :

| Contexte user × formation | Retour |
|---------------------------|--------|
| `p_formation_id` IS NULL (cas EPP V1) | `'EROJU SAS — Dentalschool'` |
| user `super_admin` | `'EROJU SAS — Dentalschool'` |
| user orgless | `'EROJU SAS — Dentalschool'` |
| user dans org `cabinet` ou `hr_entity` | `'EROJU SAS — Dentalschool'` |
| user dans `training_org` + formation Dentalschool (`owner_org_id IS NULL`) | `'EROJU SAS — Dentalschool'` |
| user dans `training_org` + formation owned par cette org | `organizations.name` (tel quel) |
| user dans `training_org` + formation d'un autre OF (cas bord) | `'EROJU SAS — Dentalschool'` (fallback) |

#### `attestation_qualiopi_for(p_user_id uuid, p_formation_id uuid) RETURNS varchar`

- Si organisme = `'EROJU SAS — Dentalschool'` → `'QUA006589'`
- Sinon → `organizations.qualiopi_number` de l'org du user (peut être `NULL`)

#### `attestation_odpc_for(p_user_id uuid, p_formation_id uuid) RETURNS varchar`

- Si organisme = `'EROJU SAS — Dentalschool'` → `'9AGA'`
- Sinon → `organizations.odpc_number` de l'org du user (peut être `NULL`)

### Trigger `trg_create_verification` enrichi

`create_verification_on_attestation()` (AFTER INSERT sur `user_attestations`) appelle désormais les 3 helpers ci-dessus et insère explicitement `organisme`, `qualiopi`, `odpc` dans `user_attestation_verifications`. Pour les attestations de type `'epp'`, on passe `p_formation_id = NULL` → fallback Dentalschool en V1.

Rétrocompatibilité : les attestations émises avant T7 ne sont pas re-traitées (pas d'UPDATE sur les lignes existantes).

### Côté code

- `src/lib/attestations/types.ts` : `AttestationOrganisme { nom, qualiopi, odpc }` + constante `DENTALSCHOOL_ORGANISME` ; champ optionnel `organisme` dans `FormationAttestationData` et `EppAttestationData`.
- `src/components/attestations/GenerateAttestationButton.tsx` : appelle `supabase.rpc('attestation_organisme_for' | '_qualiopi_for' | '_odpc_for')` avant la génération du PDF et propage la valeur.
- `src/lib/attestations/generateFormationPDF.ts` & `generateEppPDF.ts` : si organisme = Dentalschool → comportement strictement identique (titre, intro, tampon image, pied de page Qualiopi/ODPC). Sinon (OF tiers V1) : titre = nom OF, intro adaptée, ligne tableau adaptée, tampon image remplacé par cadre vide « Cachet et signature de l'organisme », pied de page sans adresse/SIRET/APE EROJU et avec Qualiopi uniquement si renseigné.

### Page `/tenant/admin/branding` (T6 étendue)

- API `PATCH /api/tenant/branding` accepte désormais `qualiopi_number` et `odpc_number` (réservés aux orgs `training_org`, validés par regex).
- UI affiche un bloc « Identifiants de certification » (Qualiopi + ODPC) uniquement pour `training_org`.

### Dette T7

- Le bandeau couleur du PDF reste teal `#0F7B6C` (Dentalschool) même pour les OF tiers ; un branding par OF (couleur primaire `organizations.branding_primary_color`) est repoussé en V1.5.
- Pas de pipeline d'upload de tampon/signature image pour les OF tiers en V1 ; cadre vide à compléter manuellement.

---

## Espace Formateur — Sprint 2 T1 (11 mai 2026)

Migration `20260511_sprint2_formateur_entities.sql` — 5 nouvelles tables + 3 helpers SQL + RLS différenciée + triggers `updated_at`. Aucune modification de code applicatif (T2+).

**Décisions produit appliquées** :
- S2.1 — masterclass live **gratuite V1** → pas de colonne `price_cents` sur `live_sessions`.
- S2.2 — visio = **lien Zoom manuel V1** → colonnes `zoom_url` + `zoom_password` sur `live_sessions`.
- Affichage inscrits formateur (T5) = compteur + prénoms via SELECT scoped `user_profiles.first_name` (cohérent RGPD modèle A).
- Convention nommage migration = `YYYYMMDD_*` (Sprint 1 prime sur `0017_*` du handoff).
- Table N:N `formation_instructors` avec `is_primary boolean` (1 formateur ↔ N formations).

### Tables (5)

#### formation_instructors — liaison N:N formateurs ↔ formations
| Colonne | Type | Notes |
|---|---|---|
| id | uuid PK | gen_random_uuid() |
| formation_id | uuid NOT NULL | FK `formations(id)` ON DELETE CASCADE |
| user_id | uuid NOT NULL | FK `auth.users(id)` ON DELETE CASCADE |
| is_primary | boolean NOT NULL | default false ; désigne le formateur principal sur la fiche formation publique |
| assigned_at | timestamptz NOT NULL | default now() |
| assigned_by | uuid | FK `auth.users(id)` — qui a fait l'assignation (Dr Fantin V1) |

UNIQUE `(formation_id, user_id)` · index `formation_instructors_user_id_idx (user_id)`.

#### formateur_profiles — profil public formateur (1 ligne / user formateur)
| Colonne | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid UNIQUE NOT NULL | FK `auth.users(id)` |
| slug | varchar(80) UNIQUE NOT NULL | `prenom-nom`, génération T2 |
| display_name | varchar(120) NOT NULL | |
| bio_short / bio_long | varchar(280) / text | court = teaser fiche ; long = page profil markdown |
| photo_pro_url | text | bucket `formateur-photos` (créé en T6) |
| linkedin_url / website_url | text | |
| expertise_tags | text[] | multi-select autocomplete T6 |
| is_published | boolean NOT NULL | default false ; passe true au "Publier mon profil" |
| published_at | timestamptz | nullable |
| created_at / updated_at | timestamptz NOT NULL | trigger `set_updated_at_formateur_profiles` |

Index `formateur_profiles_slug_idx` + partiel `formateur_profiles_published_idx (is_published) WHERE is_published = true`.

#### live_events — formations présentielles
| Colonne | Type | Notes |
|---|---|---|
| id | uuid PK | |
| formateur_user_id | uuid NOT NULL | FK `auth.users(id)` ON DELETE CASCADE — owner unique |
| formation_id | uuid | FK `formations(id)` ON DELETE SET NULL — optionnel |
| title | varchar(200) NOT NULL | |
| description | text | |
| location_city | varchar(120) NOT NULL | |
| location_venue | varchar(200) | |
| starts_at / ends_at | timestamptz | starts_at NOT NULL ; ends_at optionnel |
| external_registration_url | text | inscription externe (formateur ou Dentalschool), pas d'inscription DentalLearn pour les présentiels V1 |
| capacity | int | |
| is_published | boolean NOT NULL | default false |
| created_at / updated_at | timestamptz NOT NULL | trigger `set_updated_at_live_events` |

CHECK `live_events_dates_coherent` : `ends_at IS NULL OR ends_at > starts_at`.
Index : `live_events_formateur_idx`, `live_events_starts_at_idx`, partiel `live_events_published_upcoming_idx (starts_at) WHERE is_published = true` *(prédicat `starts_at > now()` retiré : Postgres interdit les fonctions STABLE dans un WHERE d'index partiel — le planner exploite quand même cet index pour les requêtes "upcoming")*.

#### live_sessions — masterclass live visio (Zoom manuel V1)
| Colonne | Type | Notes |
|---|---|---|
| id | uuid PK | |
| formateur_user_id | uuid NOT NULL | owner unique |
| formation_id | uuid | optionnel |
| title | varchar(200) NOT NULL | |
| description | text | |
| starts_at | timestamptz NOT NULL | |
| duration_min | int NOT NULL | default 60 |
| zoom_url | text | saisi manuellement par formateur (S2.2 V1) |
| zoom_password | varchar(100) | |
| capacity | int | |
| status | varchar(20) NOT NULL | default `'scheduled'` ; CHECK in `('draft','scheduled','live','completed','cancelled')` |
| recording_url | text | rempli post-session |
| is_published | boolean NOT NULL | default false |
| created_at / updated_at | timestamptz NOT NULL | trigger `set_updated_at_live_sessions` |

CHECK `live_sessions_status_check`. **Pas de `price_cents`** (S2.1 gratuit V1).
Index : `live_sessions_formateur_idx`, `live_sessions_starts_at_idx`, `live_sessions_status_idx`.

#### live_registrations — inscriptions aux live_sessions
| Colonne | Type | Notes |
|---|---|---|
| id | uuid PK | |
| session_id | uuid NOT NULL | FK `live_sessions(id)` ON DELETE CASCADE |
| user_id | uuid NOT NULL | FK `auth.users(id)` ON DELETE CASCADE |
| registered_at | timestamptz NOT NULL | default now() |
| attended | boolean | NULL avant session, set par formateur ou cron après |
| attended_duration_sec | int | durée effective présence |
| cancelled_at | timestamptz | annulation user (soft delete) |

UNIQUE `(session_id, user_id)`. Index `live_registrations_user_idx`, `live_registrations_session_idx`.

### Helpers SQL (3)

Pattern identique Sprint 1 : `STABLE SECURITY DEFINER`, `SET search_path = public, pg_temp`, `REVOKE EXECUTE FROM PUBLIC, anon` puis `GRANT EXECUTE TO authenticated, service_role`.

| Helper | Signature | Comportement |
|---|---|---|
| `is_formateur_of` | `(p_user_id uuid, p_formation_id uuid) → boolean` | TRUE si user est dans `formation_instructors` pour cette formation, OU super_admin (bypass). |
| `get_formateur_formations` | `(p_user_id uuid) → SETOF uuid` | liste les `formation_id` assignées au user. |
| `formateur_aggregated_stats` | `(p_user_id uuid, p_date_from date, p_date_to date) → jsonb` | **Stub T1** : retourne `'{}'::jsonb`. Signature gelée — body réécrit en T3 avec agrégats sur `user_formations` / `user_sequences` / `user_points` scopés sur `get_formateur_formations(p_user_id)` (RGPD modèle A — pas de données nominatives). |

> Note alignement Sprint 1 : les default privileges du schema `public` grantent désormais automatiquement `anon` sur les nouvelles fonctions — il faut REVOKE anon explicitement (en plus de PUBLIC) pour reproduire l'état observé des helpers Sprint 1 (`has_role`, `is_super_admin`, etc.).

### Triggers `updated_at`

Réutilisent la fonction `update_updated_at_column()` déjà en place (créée hors Sprint 1) :
- `set_updated_at_formateur_profiles` BEFORE UPDATE ON `formateur_profiles`
- `set_updated_at_live_events` BEFORE UPDATE ON `live_events`
- `set_updated_at_live_sessions` BEFORE UPDATE ON `live_sessions`

### Policies RLS (20 — 4 par table)

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `formation_instructors` | public `(true)` — exposé fiche formation publique | super_admin | super_admin | super_admin |
| `formateur_profiles` | `is_published=true` OU owner OU super_admin | super_admin | owner (`user_id=auth.uid()`) OU super_admin | super_admin |
| `live_events` | `is_published=true` OU owner OU super_admin | `(formateur_user_id=auth.uid() AND has_role('formateur'))` OU super_admin | owner OU super_admin | owner OU super_admin |
| `live_sessions` | `is_published=true` OU owner OU super_admin | `(formateur_user_id=auth.uid() AND has_role('formateur'))` OU super_admin | owner OU super_admin | owner OU super_admin |
| `live_registrations` | user concerné OU **owner strict de la session** (`live_sessions.formateur_user_id=auth.uid()`) OU super_admin | self (`user_id=auth.uid()`) | user (cancellation) OU owner session OU super_admin | super_admin (cancel = UPDATE `cancelled_at`, pas DELETE) |

> Décision Dr Fantin 2026-05-11 : RLS SELECT `live_registrations` côté formateur = **ownership strict sur `live_sessions`**, pas d'élargissement via `formation_instructors` (un co-formateur ne voit pas les inscrits d'une session qu'il n'a pas créée). Évite fuite nominative par effet de bord transitif.

### Tests d'acceptation validés (snapshot 11 mai 2026)

- ✅ Migration applicable + reversible (up/down testés sur prod via execute_sql, cleanup intégral confirmé)
- ✅ `is_formateur_of` : 3 cas testés (négatif, super_admin bypass, instructor row) → tous corrects
- ✅ `get_formateur_formations` retourne la formation assignée
- ✅ UNIQUE `formation_instructors(formation_id, user_id)` déclenche `unique_violation`
- ✅ UNIQUE `live_registrations(session_id, user_id)` déclenche `unique_violation`
- ✅ CHECK `live_events_dates_coherent` déclenche `check_violation` sur `ends_at < starts_at`
- ✅ CHECK `live_sessions_status_check` déclenche `check_violation` sur status invalide
- ✅ ACL helpers Sprint 2 alignée Sprint 1 : `{postgres, authenticated, service_role}` strict (pas d'anon)
- ✅ Advisors Supabase : aucun nouveau warning critique ; 3 warnings `authenticated_security_definer_function_executable` cohérents avec ceux des helpers Sprint 1 (`has_role`, `is_super_admin`, etc.)

### Dette T1 loggée

- D20 — Pas de seed initial dans `formation_instructors` ni `formateur_profiles` (assignations test livrées en T2 par Dr Fantin).
- D21 — Body de `formateur_aggregated_stats` à réécrire en T3 (T1 = stub). Signature gelée, pas de migration ultérieure nécessaire.
- D22 — Pas de RLS user-level testée en T1 (besoin d'un user formateur réel, livré en T2). Tests RLS d'isolation à T2/T8.
- D23 — Index partiel `live_events_published_upcoming_idx` sans prédicat `starts_at > now()` (Postgres interdit les fonctions STABLE) — à surveiller perf en T8 sur listing "upcoming" si volumétrie monte.

---

## NOTES IMPORTANTES

### ⚠️ Bug mode Preview (formations)
- `formations.access_type` défaut = `'demo'` → active le mode Preview frontend
- `user_formations.access_type` défaut = `'demo'` → même problème
- Pour activer la progression : mettre `access_type = 'full'` dans les deux tables
- **Fix immédiat Julie** :
```sql
UPDATE formations SET access_type = 'full' WHERE id = 'f9faa376-9bb0-4b19-ae0a-a6ebfa13ecb9';
```

### Tables EPP (Axe 2)
- `epp_audits` → `inclusion_criteria` + `exclusion_criteria` ajoutés le 5 avril 2026 (JSONB)
- `user_epp_sessions.completed_at IS NULL` = session en cours (T1 ou T2)
- `user_epp_responses` = réponses par dossier × critère

### Tables à surveiller (vides en prod à ce jour)
- `user_formations` → vide (bug access_type = 'demo')
- `user_sequences` → vide (dépend de user_formations)
- `user_points` → vide (dépend de user_sequences)
- `health_evaluations` → à créer (module auto-évaluation Axe 4)
- `prems_cycles` → à créer (module PROMs/PREMs Axe 3)

### Profil admin Julie
- `profiles` table : `role = 'user'` par défaut, admin détecté autrement (UUID hardcodé jusqu'à T2 Sprint 1, désormais via `is_super_admin()` SQL et `isSuperAdmin()` TS)
- `user_profiles` : pas de champ `is_admin` — l'admin est identifié par UUID dans le code

---

## Tables ajoutées par les batchs précédents (non détaillées colonne par colonne)

Les 12 tables suivantes existent en BDD post-Sprint 1 mais ne sont pas détaillées
dans ce document : leur schéma vit dans les migrations dédiées de leur batch
d'origine et est interrogeable via le MCP Supabase (`list_tables verbose=true`).

### Pipeline News (10 tables — Tickets News 1→8 Phase 1, avr-mai 2026)
- `news_taxonomy` — vocabulaires contrôlés (spécialités, thèmes, niveaux de preuve)
- `news_sources` — catalogue sources d'ingestion (PubMed, RSS, manual)
- `news_raw` — articles bruts ingérés (dédoublonnés)
- `news_scored` — scoring LLM Haiku
- `news_syntheses` — synthèses Sonnet + tagging + embedding
  - POC visualisation audio (T1, mai 2026) : 2 colonnes additives `timeline_url text NULL` + `timeline_published boolean NOT NULL DEFAULT false` (sémantique identique à `sequences.timeline_url` / `sequences.timeline_published`)
- `news_episodes` — épisodes podcast publiables
- `news_episode_items` — liaison N:N épisodes ↔ synthèses
- `news_references` — références bibliographiques par épisode (Qualiopi)
- `news_cs_comments` — fil Conseil Scientifique (placeholder V1.3)
- `news_corrections` — politique de rectification (3 ans, Qualiopi §7ter)

### Attestations + réclamations (3 tables — Tickets antérieurs)
- `user_attestations` — source unique des attestations (formation_online + EPP)
- `user_attestation_verifications` — table publique de vérification par code
- `complaints` — réclamations Qualiopi (indicateur 31)

---

## Storage buckets

Buckets Supabase Storage utilisés par l'application. RLS appliqué sur
`storage.objects` via 4 policies par bucket (SELECT public, INSERT/UPDATE/DELETE
service_role) — voir migrations dédiées pour le détail.

| Bucket | Public read | Write | MIME autorisés | Taille max | Migration | Usage |
|---|---|---|---|---|---|---|
| `news-audio` | ✅ | service_role | `audio/mpeg` | 50 MB | `20260501_news_audio_bucket.sql` | MP3 podcasts news (ElevenLabs text-to-dialogue) |
| `audio-timelines` | ✅ | service_role | `application/json` | 5 MB | `20260504a_poc_timelines.sql` | Timelines enrichies (transcript karaoké + scènes whiteboard) — POC visualisation audio T1 |

> Les autres buckets historiques (`formations`, `attestations`, etc.) ne sont
> pas encore documentés ici — leur RLS est interrogeable via le dashboard
> Supabase ou `pg_policies WHERE tablename='objects'`.

---

*Généré automatiquement depuis Supabase le 5 avril 2026*
*Mis à jour le 3 mai 2026 — clôture Sprint 1 (T1 → T7) + ticket T8 (doc finale)*
*Mis à jour le 4 mai 2026 — POC visualisation audio T1 (colonnes `timeline_url`/`timeline_published` sur `sequences` et `news_syntheses` + bucket `audio-timelines`)*
*Mis à jour le 11 mai 2026 — Sprint 2 T1 Espace Formateur (5 nouvelles tables : `formation_instructors`, `formateur_profiles`, `live_events`, `live_sessions`, `live_registrations` + 3 helpers SQL + RLS 20 policies + 3 triggers `updated_at`)*
*Mis à jour le 15 mai 2026 — Sprint 2 clôture T8 (section Espace Formateur complète : 7 tables + crons + Edge Functions)*
*À commiter dans le repo : `drfantin-star/DentalLearn-V3`*
*Chemin actuel : `docs/prototypes/DATABASE_SCHEMA.md`*

---

## Espace Formateur — Sprint 2

> Section ajoutée le 15 mai 2026 — clôture Sprint 2 (T1→T8).
> Source de vérité : MCP Supabase vérifié le 15/05/2026 (projet `dxybsuhfkwuemapqrvgz`).

### Tables

| Table | PK | FKs notables | Colonnes clés | RLS |
|---|---|---|---|---|
| `formation_instructors` | `id` uuid | `formation_id` → formations, `user_id` → auth.users | `is_primary` boolean | ✅ |
| `formateur_profiles` | `id` uuid | `user_id` → auth.users | `slug` varchar(100) **nullable** ⚠️ (D2-T6-slug), `display_name` varchar(255) **nullable**, `bio_short`, `bio_long`, `photo_pro_url`, `ville` varchar(120), `cabinet_nom` varchar(200), `annees_experience` int, `linkedin_url`, `instagram_url`, `expertise_tags` text[], `is_published` boolean, `published_at` timestamptz | ✅ |
| `live_events` | `id` uuid | `formateur_user_id` → auth.users, `formation_id` → formations (nullable) | `title`, `location_city`, `location_venue`, `starts_at`, `ends_at`, `capacity`, `external_registration_url`, `is_published`, `deleted_at` (soft delete) | ✅ |
| `live_sessions` | `id` uuid | `formateur_user_id` → auth.users, `formation_id` → formations (nullable) | `title`, `starts_at`, `duration_min`, `zoom_url`, `zoom_password` (en clair V1), `capacity`, `status` enum (scheduled/live/ended/cancelled), `recording_url`, `is_published`, `deleted_at` (soft delete) | ✅ |
| `live_registrations` | `id` uuid | `session_id` → live_sessions, `user_id` → auth.users | `registered_at`, `attended` boolean, `attended_duration_sec` int, `cancelled_at` (nullable — inutilisée V1, D2-T5-01) | ✅ |
| `formateur_followers` | `id` uuid | `user_id` → auth.users, `formateur_user_id` → auth.users | `followed_at` — UNIQUE(user_id, formateur_user_id) | ✅ |
| `live_session_reminders_sent` | `id` uuid | `session_id` → live_sessions, `user_id` → auth.users | `reminder_type` varchar(20) CHECK IN ('j_minus_1', 'h_minus_1'), `sent_at` — UNIQUE(session_id, user_id, reminder_type) | ✅ (activée T8) |

**Conventions de nommage coexistantes (piège confirmé)** :
- `formateur_profiles.user_id` — convention T1
- `live_sessions.formateur_user_id` — convention T1 différente
- Toujours vérifier avant d'écrire une requête.

**Soft delete** : `live_events.deleted_at` et `live_sessions.deleted_at` — toujours filtrer `deleted_at IS NULL` dans les SELECT (sauf super_admin).

**⚠️ Dette D2-T6-slug** : `slug` et `display_name` sont nullable comme garde-fou (migration PR #284). Fix propre prévu Sprint 3 : générer automatiquement depuis `auth.users.email` dans `PATCH /api/formateur/profil` si absent. Workaround actuel : hydratation SQL manuelle par super_admin.

### Helpers SQL Sprint 2 (SECURITY DEFINER, SET search_path = public, pg_temp)

| Fonction | Signature | Retour | Garde auth.uid() |
|---|---|---|---|
| `is_formateur_of` | `(p_user_id uuid, p_formation_id uuid)` | boolean | Non (boolean safe) |
| `get_formateur_formations` | `(p_user_id uuid)` | SETOF uuid | Non |
| `formateur_aggregated_stats` | `(p_user_id uuid, p_date_from date, p_date_to date)` | jsonb | **Oui** (fix T3 — 42501 si cross-user) |

ACL pattern : `REVOKE EXECUTE FROM PUBLIC, anon, authenticated` + `GRANT EXECUTE TO authenticated, service_role`.

### Colonnes ajoutées par ticket (Sprint 2)

| Table | Colonne | Migration | Ticket |
|---|---|---|---|
| `live_events` | `deleted_at timestamptz` | 20260514_sprint2_live_events_deleted_at | T4 |
| `live_sessions` | `deleted_at timestamptz` | 20260514_sprint2_sessions_rls_fix | T5 |
| `formateur_profiles` | `annees_experience int` | 20260515_sprint2_formateur_profile_fields | T6 |
| `formateur_profiles` | `ville varchar(120)` | 20260515_sprint2_formateur_profile_fields | T6 |
| `formateur_profiles` | `cabinet_nom varchar(200)` | 20260515_sprint2_formateur_profile_fields | T6 |
| `formateur_profiles` | `instagram_url text` | 20260515_sprint2_formateur_profile_fields | T6 |
| `notifications` | `metadata jsonb` | 20260515_sprint2_t7_notifications_followers | T7 |
| `user_notification_preferences` | `live_session_reminders boolean DEFAULT true` | 20260515_sprint2_t7_notifications_followers | T7 |
| `user_notification_preferences` | `formateur_publications boolean DEFAULT true` | 20260515_sprint2_t7_notifications_followers | T7 |

### Crons Sprint 2

| Job pg_cron | Schedule | Edge Function déclenchée | Rôle |
|---|---|---|---|
| `live_session_reminders` | `0 * * * *` (toutes les heures, h:00) | `live_session_reminders` | Rappels push J-1 + H-1 aux inscrits live_sessions |
| `notify_followers_new_publication` | `30 * * * *` (toutes les heures, h:30) | `notify_followers_new_publication` | Notif followers lors d'une nouvelle publication formateur |

Migration cron : `20260515_sprint2_t7_crons.sql`. Limite par run : 50 (configurable via body POST `{"limit": N}`, max 200).

### Edge Functions Sprint 2

**`live_session_reminders`** (`supabase/functions/live_session_reminders/index.ts`)
- Fenêtre J-1 : `starts_at ∈ [now()+23h, now()+25h]` → `reminder_type = 'j_minus_1'`
- Fenêtre H-1 : `starts_at ∈ [now()+45min, now()+75min]` → `reminder_type = 'h_minus_1'`
- Idempotence : `INSERT live_session_reminders_sent ON CONFLICT DO NOTHING`
- Respect préférence `user_notification_preferences.live_session_reminders` (row absente = true par défaut)
- Heure affichée `Europe/Paris` dans le corps push
- Dépendances : `npm:web-push@3.6.7`, VAPID keys via `Deno.env.get()` (secrets Supabase — PAS Vercel)

**`notify_followers_new_publication`** (`supabase/functions/notify_followers_new_publication/index.ts`)
- Détecte `live_sessions` publiées dans la dernière heure (`created_at >= now() - interval '1h'`)
- Debounce 24h via `notifications.metadata->>'formateur_user_id'`
- Respect préférence `user_notification_preferences.formateur_publications`
- ⚠️ **Dette D2-T7-02** : déclenché sur `created_at` (pas `published_at`) — session créée >1h avant publication non notifiée → Sprint 3

---

## Pipeline Audio Unifié — Sprint 4 T1 (16 mai 2026)

Migration : `supabase/migrations/20260516_sprint4_audio_jobs.sql` (+ `_down.sql`
symétrique). Fondations BDD pour le portage en backend Next.js de la
génération audio ElevenLabs (formations + news), précédemment exécutée via
le script Python `generate_audio_PHASE_2B.py`.

### Enum `audio_job_status`

`'pending' | 'running' | 'completed' | 'failed' | 'cancelled'`

### audio_generation_jobs — suivi des jobs de génération audio

| Colonne | Type | Notes |
|---|---|---|
| id | uuid PK | `gen_random_uuid()` |
| sequence_id | uuid | FK `sequences(id)` ON DELETE CASCADE — nullable (XOR avec `news_episode_id`) |
| news_episode_id | uuid | FK `news_episodes(id)` ON DELETE CASCADE — nullable (XOR avec `sequence_id`) |
| triggered_by | uuid NOT NULL | FK `auth.users(id)` — qui a lancé le job |
| status | audio_job_status NOT NULL | default `'pending'` |
| started_at | timestamptz | rempli au passage en `'running'` |
| completed_at | timestamptz | rempli au passage en `'completed'` / `'failed'` / `'cancelled'` |
| script_text | text NOT NULL | snapshot du script dialogue Sophie/Martin (post-validation) |
| with_timestamps | boolean NOT NULL | default `true` ; détermine `text_to_dialogue` vs `convert_with_timestamps` |
| audio_url | text | URL publique MP3 sur Supabase Storage (`formations` ou `news-audio`) |
| timeline_url | text | URL publique JSON timeline (bucket `audio-timelines`) |
| duration_sec | int | durée totale (somme des chunks) |
| chars_consumed | int | total caractères facturés ElevenLabs |
| cost_eur | numeric(10,4) | coût estimé EUR (chars / 1000 × tarif) |
| error_log | jsonb | `{ message, chunk_index?, api_status?, stack?, timestamp }` |
| retry_count | int NOT NULL | default 0 |
| created_at | timestamptz NOT NULL | default `now()` |
| updated_at | timestamptz NOT NULL | default `now()` ; maintenu par trigger `audio_jobs_updated_at` |

**Contraintes** :
- `CHECK exactly_one_target` : exactement un de `sequence_id` / `news_episode_id` est non-NULL (XOR strict).

**Indexes** :
- `audio_jobs_sequence_idx (sequence_id) WHERE sequence_id IS NOT NULL` — partiel
- `audio_jobs_news_episode_idx (news_episode_id) WHERE news_episode_id IS NOT NULL` — partiel
- `audio_jobs_status_idx (status) WHERE status IN ('pending','running')` — partiel, optimisé pour le sweep des jobs actifs et le polling UI
- `audio_jobs_triggered_by_idx (triggered_by)`
- `audio_jobs_created_at_idx (created_at DESC)`

**RLS** : 3 policies `audio_jobs_{select,insert,update}_super_admin` (rôle `authenticated`, `USING/WITH CHECK is_super_admin(auth.uid())`). Aucun DELETE exposé : un job échoué reste en historique. Les workers backend qui écrivent contournent RLS via service_role (clé serveur).

**Trigger** : `audio_jobs_updated_at BEFORE UPDATE` → fonction `update_audio_jobs_updated_at()` (met à jour `NEW.updated_at = now()`).

### Colonnes ajoutées sur `sequences` (additives)

| Colonne | Type | Notes |
|---|---|---|
| audio_generated_at | timestamptz | horodatage de la dernière génération réussie |
| audio_chars_consumed | int | caractères facturés sur la version courante |
| audio_cost_eur | numeric(10,4) | coût EUR de la version courante |
| audio_history | jsonb NOT NULL | default `'[]'::jsonb` ; array de `{ audio_url, generated_at, replaced_at, chars, cost_eur }` — conservation indéfinie (faible volume, traçabilité des régénérations) |

### Smoke test

`scripts/smoke_test_sprint4_t1.sql` vérifie : présence enum, table, contrainte XOR, RLS activée, 4 colonnes `sequences`, index status.
