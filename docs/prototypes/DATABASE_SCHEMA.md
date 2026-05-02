# DENTALLEARN V3 — DATABASE SCHEMA
## Récupéré depuis Supabase le 5 avril 2026
## Project ID : dxybsuhfkwuemapqrvgz

---

## TABLES (38 tables)

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
- `profiles` table : `role = 'user'` par défaut, admin détecté autrement (UUID hardcodé)
- `user_profiles` : pas de champ `is_admin` — l'admin est identifié par UUID dans le code

---

*Généré automatiquement depuis Supabase le 5 avril 2026*
*À commiter dans le repo : `drfantin-star/DentalLearn-V3`*
*Chemin suggéré : `docs/DATABASE_SCHEMA.md`*
