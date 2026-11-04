SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: citext; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public;


--
-- Name: EXTENSION citext; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION citext IS 'data type for case-insensitive character strings';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: ledger_events_append_only(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ledger_events_append_only() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  RAISE EXCEPTION 'ledger_events is append-only';
END;
$$;


--
-- Name: statements_frozen(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.statements_frozen() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  RAISE EXCEPTION 'statements are frozen once generated';
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admin_audit_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_audit_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    staff_user_id uuid,
    action character varying NOT NULL,
    target_type character varying,
    target_id uuid,
    reason character varying,
    params jsonb DEFAULT '{}'::jsonb NOT NULL,
    ip character varying,
    user_agent character varying,
    created_at timestamp(6) without time zone NOT NULL
);


--
-- Name: analytics_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.analytics_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying NOT NULL,
    user_id uuid,
    household_id uuid,
    props jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp(6) without time zone NOT NULL
);


--
-- Name: ar_internal_metadata; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ar_internal_metadata (
    key character varying NOT NULL,
    value character varying,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


--
-- Name: bill_cycles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bill_cycles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bill_id uuid NOT NULL,
    household_id uuid NOT NULL,
    due_on date NOT NULL,
    status character varying DEFAULT 'upcoming'::character varying NOT NULL,
    amount_override_cents bigint,
    expense_id uuid,
    waiting_since date,
    amount_entered_on date,
    reminders_sent integer DEFAULT 0 NOT NULL,
    last_reminded_at timestamp(6) without time zone,
    posted_at timestamp(6) without time zone,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    CONSTRAINT cycle_status_values CHECK (((status)::text = ANY ((ARRAY['upcoming'::character varying, 'waiting'::character varying, 'posted'::character varying, 'skipped'::character varying])::text[])))
);


--
-- Name: bills; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bills (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    household_id uuid NOT NULL,
    payer_id uuid NOT NULL,
    created_by_id uuid NOT NULL,
    name character varying NOT NULL,
    kind character varying DEFAULT 'fixed'::character varying NOT NULL,
    amount_cents bigint,
    due_day integer NOT NULL,
    post_days_early integer DEFAULT 0 NOT NULL,
    usual_arrival_day integer,
    category character varying DEFAULT 'utilities'::character varying NOT NULL,
    split_kind character varying DEFAULT 'equal'::character varying NOT NULL,
    split_weights jsonb DEFAULT '{}'::jsonb NOT NULL,
    participant_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    starts_on date DEFAULT CURRENT_DATE NOT NULL,
    CONSTRAINT bill_due_day_range CHECK (((due_day >= 1) AND (due_day <= 28))),
    CONSTRAINT bill_early_range CHECK (((post_days_early >= 0) AND (post_days_early <= 7))),
    CONSTRAINT bill_kind_values CHECK (((kind)::text = ANY ((ARRAY['fixed'::character varying, 'variable'::character varying])::text[]))),
    CONSTRAINT fixed_bill_has_amount CHECK ((((kind)::text = 'variable'::text) OR (amount_cents > 0)))
);


--
-- Name: expense_shares; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expense_shares (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    expense_id uuid NOT NULL,
    member_id uuid NOT NULL,
    share_cents bigint NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    CONSTRAINT share_nonnegative CHECK ((share_cents >= 0))
);


--
-- Name: expenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expenses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    household_id uuid NOT NULL,
    payer_id uuid NOT NULL,
    created_by_id uuid NOT NULL,
    amount_cents bigint NOT NULL,
    description character varying DEFAULT ''::character varying NOT NULL,
    category character varying DEFAULT 'other'::character varying NOT NULL,
    spent_on date NOT NULL,
    split_kind character varying DEFAULT 'equal'::character varying NOT NULL,
    split_weights jsonb DEFAULT '{}'::jsonb NOT NULL,
    urgency character varying DEFAULT 'tab'::character varying NOT NULL,
    note character varying,
    version integer DEFAULT 1 NOT NULL,
    deleted_at timestamp(6) without time zone,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    client_id character varying,
    CONSTRAINT amount_positive CHECK ((amount_cents > 0)),
    CONSTRAINT split_kind_values CHECK (((split_kind)::text = ANY ((ARRAY['equal'::character varying, 'percent'::character varying, 'exact'::character varying, 'shares'::character varying])::text[]))),
    CONSTRAINT urgency_values CHECK (((urgency)::text = ANY ((ARRAY['soon'::character varying, 'tab'::character varying])::text[])))
);


--
-- Name: households; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.households (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying NOT NULL,
    currency character varying DEFAULT 'USD'::character varying NOT NULL,
    statement_day integer DEFAULT 1 NOT NULL,
    default_split_kind character varying DEFAULT 'equal'::character varying NOT NULL,
    default_split_weights jsonb DEFAULT '{}'::jsonb NOT NULL,
    simplify_debts boolean DEFAULT false NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    CONSTRAINT statement_day_range CHECK (((statement_day >= 1) AND (statement_day <= 28)))
);


--
-- Name: identities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.identities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    provider character varying NOT NULL,
    provider_uid character varying NOT NULL,
    email public.citext,
    email_verified boolean DEFAULT false NOT NULL,
    last_used_at timestamp(6) without time zone,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


--
-- Name: invites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    household_id uuid NOT NULL,
    created_by_id uuid NOT NULL,
    member_id uuid,
    token character varying NOT NULL,
    expires_at timestamp(6) without time zone NOT NULL,
    accepted_at timestamp(6) without time zone,
    accepted_by_user_id uuid,
    revoked_at timestamp(6) without time zone,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


--
-- Name: ledger_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ledger_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    household_id uuid NOT NULL,
    actor_member_id uuid,
    actor_type character varying DEFAULT 'member'::character varying NOT NULL,
    actor_staff_id uuid,
    kind character varying NOT NULL,
    subject_type character varying NOT NULL,
    subject_id uuid NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    occurred_at timestamp(6) without time zone NOT NULL,
    created_at timestamp(6) without time zone NOT NULL
);


--
-- Name: members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    household_id uuid NOT NULL,
    user_id uuid,
    display_name character varying NOT NULL,
    moved_in_on date,
    moved_out_on date,
    venmo_handle character varying,
    cashtag character varying,
    zelle_contact character varying,
    left_at timestamp(6) without time zone,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    auto_remind boolean DEFAULT true NOT NULL,
    remind_threshold_cents bigint DEFAULT 4000 NOT NULL,
    remind_after_days integer DEFAULT 7 NOT NULL,
    CONSTRAINT move_dates_order CHECK (((moved_out_on IS NULL) OR (moved_in_on IS NULL) OR (moved_out_on >= moved_in_on)))
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    household_id uuid,
    kind character varying NOT NULL,
    title character varying NOT NULL,
    body character varying NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    group_key character varying,
    group_count integer DEFAULT 1 NOT NULL,
    group_cents bigint DEFAULT 0 NOT NULL,
    deliver_after timestamp(6) without time zone NOT NULL,
    sent_at timestamp(6) without time zone,
    read_at timestamp(6) without time zone,
    skipped_reason character varying,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


--
-- Name: payment_allocations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_allocations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    payment_id uuid NOT NULL,
    expense_id uuid NOT NULL,
    cents bigint NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    CONSTRAINT allocation_positive CHECK ((cents > 0))
);


--
-- Name: payment_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    household_id uuid NOT NULL,
    requester_id uuid NOT NULL,
    recipient_id uuid NOT NULL,
    token character varying NOT NULL,
    amount_cents bigint NOT NULL,
    breakdown jsonb DEFAULT '[]'::jsonb NOT NULL,
    pay_methods jsonb DEFAULT '{}'::jsonb NOT NULL,
    first_viewed_at timestamp(6) without time zone,
    views integer DEFAULT 0 NOT NULL,
    paid_marked_at timestamp(6) without time zone,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    CONSTRAINT request_positive CHECK ((amount_cents > 0))
);


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    household_id uuid NOT NULL,
    from_member_id uuid NOT NULL,
    to_member_id uuid NOT NULL,
    recorded_by_id uuid NOT NULL,
    amount_cents bigint NOT NULL,
    method character varying DEFAULT 'other'::character varying NOT NULL,
    status character varying DEFAULT 'pending'::character varying NOT NULL,
    note character varying,
    marked_at timestamp(6) without time zone NOT NULL,
    confirmed_at timestamp(6) without time zone,
    disputed_at timestamp(6) without time zone,
    auto_confirm_at timestamp(6) without time zone,
    auto_confirmed boolean DEFAULT false NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    reminded_at timestamp(6) without time zone,
    CONSTRAINT payment_distinct_members CHECK ((from_member_id <> to_member_id)),
    CONSTRAINT payment_positive CHECK ((amount_cents > 0)),
    CONSTRAINT payment_status_values CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'confirmed'::character varying, 'disputed'::character varying])::text[])))
);


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    version character varying NOT NULL
);


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token_digest character varying NOT NULL,
    device_name character varying,
    platform character varying,
    app_version character varying,
    push_token character varying,
    ip character varying,
    last_seen_at timestamp(6) without time zone,
    revoked_at timestamp(6) without time zone,
    revoked_reason character varying,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


--
-- Name: sign_in_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sign_in_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    channel character varying NOT NULL,
    destination character varying NOT NULL,
    code_digest character varying NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    expires_at timestamp(6) without time zone NOT NULL,
    consumed_at timestamp(6) without time zone,
    requested_ip character varying,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


--
-- Name: staff_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    staff_user_id uuid NOT NULL,
    token_digest character varying NOT NULL,
    ip character varying,
    user_agent character varying,
    expires_at timestamp(6) without time zone NOT NULL,
    revoked_at timestamp(6) without time zone,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


--
-- Name: staff_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff_users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email public.citext NOT NULL,
    name character varying NOT NULL,
    role character varying DEFAULT 'viewer'::character varying NOT NULL,
    password_digest character varying NOT NULL,
    otp_secret character varying,
    otp_enabled_at timestamp(6) without time zone,
    last_otp_step integer,
    failed_attempts integer DEFAULT 0 NOT NULL,
    locked_at timestamp(6) without time zone,
    disabled_at timestamp(6) without time zone,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    CONSTRAINT staff_role_values CHECK (((role)::text = ANY ((ARRAY['viewer'::character varying, 'support'::character varying, 'admin'::character varying])::text[])))
);


--
-- Name: statements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.statements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    household_id uuid NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    generated_at timestamp(6) without time zone NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    first_name character varying DEFAULT ''::character varying NOT NULL,
    last_name character varying,
    email public.citext,
    phone character varying,
    locked_at timestamp(6) without time zone,
    locked_reason character varying,
    deleted_at timestamp(6) without time zone,
    last_active_at timestamp(6) without time zone,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    time_zone character varying DEFAULT 'America/New_York'::character varying NOT NULL,
    quiet_start_hour integer DEFAULT 22 NOT NULL,
    quiet_end_hour integer DEFAULT 8 NOT NULL,
    notification_prefs jsonb DEFAULT '{}'::jsonb NOT NULL,
    face_id_lock boolean DEFAULT false NOT NULL
);


--
-- Name: admin_audit_events admin_audit_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_audit_events
    ADD CONSTRAINT admin_audit_events_pkey PRIMARY KEY (id);


--
-- Name: analytics_events analytics_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_events
    ADD CONSTRAINT analytics_events_pkey PRIMARY KEY (id);


--
-- Name: ar_internal_metadata ar_internal_metadata_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ar_internal_metadata
    ADD CONSTRAINT ar_internal_metadata_pkey PRIMARY KEY (key);


--
-- Name: bill_cycles bill_cycles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bill_cycles
    ADD CONSTRAINT bill_cycles_pkey PRIMARY KEY (id);


--
-- Name: bills bills_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bills
    ADD CONSTRAINT bills_pkey PRIMARY KEY (id);


--
-- Name: expense_shares expense_shares_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_shares
    ADD CONSTRAINT expense_shares_pkey PRIMARY KEY (id);


--
-- Name: expenses expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);


--
-- Name: households households_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.households
    ADD CONSTRAINT households_pkey PRIMARY KEY (id);


--
-- Name: identities identities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.identities
    ADD CONSTRAINT identities_pkey PRIMARY KEY (id);


--
-- Name: invites invites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invites
    ADD CONSTRAINT invites_pkey PRIMARY KEY (id);


--
-- Name: ledger_events ledger_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ledger_events
    ADD CONSTRAINT ledger_events_pkey PRIMARY KEY (id);


--
-- Name: members members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.members
    ADD CONSTRAINT members_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: payment_allocations payment_allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_allocations
    ADD CONSTRAINT payment_allocations_pkey PRIMARY KEY (id);


--
-- Name: payment_requests payment_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_requests
    ADD CONSTRAINT payment_requests_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sign_in_codes sign_in_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sign_in_codes
    ADD CONSTRAINT sign_in_codes_pkey PRIMARY KEY (id);


--
-- Name: staff_sessions staff_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_sessions
    ADD CONSTRAINT staff_sessions_pkey PRIMARY KEY (id);


--
-- Name: staff_users staff_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_users
    ADD CONSTRAINT staff_users_pkey PRIMARY KEY (id);


--
-- Name: statements statements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.statements
    ADD CONSTRAINT statements_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: index_admin_audit_events_on_staff_user_id_and_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_admin_audit_events_on_staff_user_id_and_created_at ON public.admin_audit_events USING btree (staff_user_id, created_at);


--
-- Name: index_admin_audit_events_on_target_type_and_target_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_admin_audit_events_on_target_type_and_target_id ON public.admin_audit_events USING btree (target_type, target_id);


--
-- Name: index_analytics_events_on_name_and_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_analytics_events_on_name_and_created_at ON public.analytics_events USING btree (name, created_at);


--
-- Name: index_bill_cycles_on_bill_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_bill_cycles_on_bill_id ON public.bill_cycles USING btree (bill_id);


--
-- Name: index_bill_cycles_on_bill_id_and_due_on; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_bill_cycles_on_bill_id_and_due_on ON public.bill_cycles USING btree (bill_id, due_on);


--
-- Name: index_bill_cycles_on_expense_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_bill_cycles_on_expense_id ON public.bill_cycles USING btree (expense_id);


--
-- Name: index_bill_cycles_on_household_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_bill_cycles_on_household_id ON public.bill_cycles USING btree (household_id);


--
-- Name: index_bills_on_created_by_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_bills_on_created_by_id ON public.bills USING btree (created_by_id);


--
-- Name: index_bills_on_household_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_bills_on_household_id ON public.bills USING btree (household_id);


--
-- Name: index_bills_on_payer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_bills_on_payer_id ON public.bills USING btree (payer_id);


--
-- Name: index_expense_shares_on_expense_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_expense_shares_on_expense_id ON public.expense_shares USING btree (expense_id);


--
-- Name: index_expense_shares_on_expense_id_and_member_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_expense_shares_on_expense_id_and_member_id ON public.expense_shares USING btree (expense_id, member_id);


--
-- Name: index_expense_shares_on_member_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_expense_shares_on_member_id ON public.expense_shares USING btree (member_id);


--
-- Name: index_expenses_on_created_by_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_expenses_on_created_by_id ON public.expenses USING btree (created_by_id);


--
-- Name: index_expenses_on_household_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_expenses_on_household_id ON public.expenses USING btree (household_id);


--
-- Name: index_expenses_on_household_id_and_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_expenses_on_household_id_and_client_id ON public.expenses USING btree (household_id, client_id) WHERE (client_id IS NOT NULL);


--
-- Name: index_expenses_on_household_id_and_spent_on; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_expenses_on_household_id_and_spent_on ON public.expenses USING btree (household_id, spent_on);


--
-- Name: index_expenses_on_payer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_expenses_on_payer_id ON public.expenses USING btree (payer_id);


--
-- Name: index_identities_on_provider_and_provider_uid; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_identities_on_provider_and_provider_uid ON public.identities USING btree (provider, provider_uid);


--
-- Name: index_identities_on_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_identities_on_user_id ON public.identities USING btree (user_id);


--
-- Name: index_invites_on_created_by_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_invites_on_created_by_id ON public.invites USING btree (created_by_id);


--
-- Name: index_invites_on_household_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_invites_on_household_id ON public.invites USING btree (household_id);


--
-- Name: index_invites_on_member_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_invites_on_member_id ON public.invites USING btree (member_id);


--
-- Name: index_invites_on_token; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_invites_on_token ON public.invites USING btree (token);


--
-- Name: index_ledger_events_on_household_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ledger_events_on_household_id ON public.ledger_events USING btree (household_id);


--
-- Name: index_ledger_events_on_household_id_and_occurred_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ledger_events_on_household_id_and_occurred_at ON public.ledger_events USING btree (household_id, occurred_at);


--
-- Name: index_ledger_events_on_subject_type_and_subject_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ledger_events_on_subject_type_and_subject_id ON public.ledger_events USING btree (subject_type, subject_id);


--
-- Name: index_members_on_household_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_members_on_household_id ON public.members USING btree (household_id);


--
-- Name: index_members_on_household_id_and_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_members_on_household_id_and_user_id ON public.members USING btree (household_id, user_id) WHERE (user_id IS NOT NULL);


--
-- Name: index_notifications_on_group_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_notifications_on_group_key ON public.notifications USING btree (group_key) WHERE ((group_key IS NOT NULL) AND (sent_at IS NULL));


--
-- Name: index_notifications_on_household_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_notifications_on_household_id ON public.notifications USING btree (household_id);


--
-- Name: index_notifications_on_sent_at_and_deliver_after; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_notifications_on_sent_at_and_deliver_after ON public.notifications USING btree (sent_at, deliver_after);


--
-- Name: index_notifications_on_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_notifications_on_user_id ON public.notifications USING btree (user_id);


--
-- Name: index_notifications_on_user_id_and_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_notifications_on_user_id_and_created_at ON public.notifications USING btree (user_id, created_at);


--
-- Name: index_payment_allocations_on_expense_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_payment_allocations_on_expense_id ON public.payment_allocations USING btree (expense_id);


--
-- Name: index_payment_allocations_on_payment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_payment_allocations_on_payment_id ON public.payment_allocations USING btree (payment_id);


--
-- Name: index_payment_requests_on_household_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_payment_requests_on_household_id ON public.payment_requests USING btree (household_id);


--
-- Name: index_payment_requests_on_recipient_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_payment_requests_on_recipient_id ON public.payment_requests USING btree (recipient_id);


--
-- Name: index_payment_requests_on_requester_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_payment_requests_on_requester_id ON public.payment_requests USING btree (requester_id);


--
-- Name: index_payment_requests_on_token; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_payment_requests_on_token ON public.payment_requests USING btree (token);


--
-- Name: index_payments_on_from_member_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_payments_on_from_member_id ON public.payments USING btree (from_member_id);


--
-- Name: index_payments_on_household_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_payments_on_household_id ON public.payments USING btree (household_id);


--
-- Name: index_payments_on_recorded_by_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_payments_on_recorded_by_id ON public.payments USING btree (recorded_by_id);


--
-- Name: index_payments_on_status_and_auto_confirm_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_payments_on_status_and_auto_confirm_at ON public.payments USING btree (status, auto_confirm_at);


--
-- Name: index_payments_on_to_member_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_payments_on_to_member_id ON public.payments USING btree (to_member_id);


--
-- Name: index_sessions_on_token_digest; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_sessions_on_token_digest ON public.sessions USING btree (token_digest);


--
-- Name: index_sessions_on_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_sessions_on_user_id ON public.sessions USING btree (user_id);


--
-- Name: index_sign_in_codes_on_destination_and_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_sign_in_codes_on_destination_and_created_at ON public.sign_in_codes USING btree (destination, created_at);


--
-- Name: index_staff_sessions_on_staff_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_staff_sessions_on_staff_user_id ON public.staff_sessions USING btree (staff_user_id);


--
-- Name: index_staff_sessions_on_token_digest; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_staff_sessions_on_token_digest ON public.staff_sessions USING btree (token_digest);


--
-- Name: index_staff_users_on_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_staff_users_on_email ON public.staff_users USING btree (email);


--
-- Name: index_statements_on_household_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_statements_on_household_id ON public.statements USING btree (household_id);


--
-- Name: index_statements_on_household_id_and_period_end; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_statements_on_household_id_and_period_end ON public.statements USING btree (household_id, period_end);


--
-- Name: index_users_on_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_users_on_email ON public.users USING btree (email) WHERE ((email IS NOT NULL) AND (deleted_at IS NULL));


--
-- Name: index_users_on_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_users_on_phone ON public.users USING btree (phone) WHERE ((phone IS NOT NULL) AND (deleted_at IS NULL));


--
-- Name: ledger_events ledger_events_no_update_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER ledger_events_no_update_delete BEFORE DELETE OR UPDATE ON public.ledger_events FOR EACH ROW EXECUTE FUNCTION public.ledger_events_append_only();


--
-- Name: statements statements_no_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER statements_no_update BEFORE UPDATE ON public.statements FOR EACH ROW EXECUTE FUNCTION public.statements_frozen();


--
-- Name: members fk_rails_0d32f0b4d5; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.members
    ADD CONSTRAINT fk_rails_0d32f0b4d5 FOREIGN KEY (household_id) REFERENCES public.households(id);


--
-- Name: payments fk_rails_0d67b3e3c0; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT fk_rails_0d67b3e3c0 FOREIGN KEY (to_member_id) REFERENCES public.members(id);


--
-- Name: payment_requests fk_rails_1b565f11f3; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_requests
    ADD CONSTRAINT fk_rails_1b565f11f3 FOREIGN KEY (recipient_id) REFERENCES public.members(id);


--
-- Name: bills fk_rails_2309d98731; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bills
    ADD CONSTRAINT fk_rails_2309d98731 FOREIGN KEY (household_id) REFERENCES public.households(id);


--
-- Name: statements fk_rails_283515f435; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.statements
    ADD CONSTRAINT fk_rails_283515f435 FOREIGN KEY (household_id) REFERENCES public.households(id);


--
-- Name: bill_cycles fk_rails_2aafedff0a; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bill_cycles
    ADD CONSTRAINT fk_rails_2aafedff0a FOREIGN KEY (household_id) REFERENCES public.households(id);


--
-- Name: payment_requests fk_rails_2e2d643cec; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_requests
    ADD CONSTRAINT fk_rails_2e2d643cec FOREIGN KEY (household_id) REFERENCES public.households(id);


--
-- Name: members fk_rails_2e88fb7ce9; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.members
    ADD CONSTRAINT fk_rails_2e88fb7ce9 FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: payments fk_rails_2ffe474959; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT fk_rails_2ffe474959 FOREIGN KEY (household_id) REFERENCES public.households(id);


--
-- Name: bills fk_rails_343f72700f; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bills
    ADD CONSTRAINT fk_rails_343f72700f FOREIGN KEY (payer_id) REFERENCES public.members(id);


--
-- Name: identities fk_rails_5373344100; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.identities
    ADD CONSTRAINT fk_rails_5373344100 FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: notifications fk_rails_5c22549406; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT fk_rails_5c22549406 FOREIGN KEY (household_id) REFERENCES public.households(id);


--
-- Name: bill_cycles fk_rails_73d495125c; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bill_cycles
    ADD CONSTRAINT fk_rails_73d495125c FOREIGN KEY (expense_id) REFERENCES public.expenses(id);


--
-- Name: sessions fk_rails_758836b4f0; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT fk_rails_758836b4f0 FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: payments fk_rails_872d859cfb; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT fk_rails_872d859cfb FOREIGN KEY (recorded_by_id) REFERENCES public.members(id);


--
-- Name: bill_cycles fk_rails_90eae61202; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bill_cycles
    ADD CONSTRAINT fk_rails_90eae61202 FOREIGN KEY (bill_id) REFERENCES public.bills(id);


--
-- Name: staff_sessions fk_rails_999e6e7559; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_sessions
    ADD CONSTRAINT fk_rails_999e6e7559 FOREIGN KEY (staff_user_id) REFERENCES public.staff_users(id);


--
-- Name: bills fk_rails_9b100a5025; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bills
    ADD CONSTRAINT fk_rails_9b100a5025 FOREIGN KEY (created_by_id) REFERENCES public.members(id);


--
-- Name: ledger_events fk_rails_9cf3b80290; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ledger_events
    ADD CONSTRAINT fk_rails_9cf3b80290 FOREIGN KEY (household_id) REFERENCES public.households(id);


--
-- Name: invites fk_rails_ad14834a80; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invites
    ADD CONSTRAINT fk_rails_ad14834a80 FOREIGN KEY (household_id) REFERENCES public.households(id);


--
-- Name: payments fk_rails_ad7b600208; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT fk_rails_ad7b600208 FOREIGN KEY (from_member_id) REFERENCES public.members(id);


--
-- Name: notifications fk_rails_b080fb4855; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT fk_rails_b080fb4855 FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: invites fk_rails_b52eeab183; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invites
    ADD CONSTRAINT fk_rails_b52eeab183 FOREIGN KEY (created_by_id) REFERENCES public.members(id);


--
-- Name: payment_requests fk_rails_c939717654; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_requests
    ADD CONSTRAINT fk_rails_c939717654 FOREIGN KEY (requester_id) REFERENCES public.members(id);


--
-- Name: expense_shares fk_rails_d579d2fb80; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_shares
    ADD CONSTRAINT fk_rails_d579d2fb80 FOREIGN KEY (expense_id) REFERENCES public.expenses(id);


--
-- Name: expenses fk_rails_d72841bfc3; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT fk_rails_d72841bfc3 FOREIGN KEY (payer_id) REFERENCES public.members(id);


--
-- Name: payment_allocations fk_rails_d8766ea65a; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_allocations
    ADD CONSTRAINT fk_rails_d8766ea65a FOREIGN KEY (expense_id) REFERENCES public.expenses(id);


--
-- Name: invites fk_rails_dff58bdd03; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invites
    ADD CONSTRAINT fk_rails_dff58bdd03 FOREIGN KEY (member_id) REFERENCES public.members(id);


--
-- Name: expense_shares fk_rails_e3af6b6889; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_shares
    ADD CONSTRAINT fk_rails_e3af6b6889 FOREIGN KEY (member_id) REFERENCES public.members(id);


--
-- Name: payment_allocations fk_rails_f28de73578; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_allocations
    ADD CONSTRAINT fk_rails_f28de73578 FOREIGN KEY (payment_id) REFERENCES public.payments(id);


--
-- Name: expenses fk_rails_f6627b9ddd; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT fk_rails_f6627b9ddd FOREIGN KEY (household_id) REFERENCES public.households(id);


--
-- Name: expenses fk_rails_f7e2e7081b; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT fk_rails_f7e2e7081b FOREIGN KEY (created_by_id) REFERENCES public.members(id);


--
-- PostgreSQL database dump complete
--

SET search_path TO "$user", public;

INSERT INTO "schema_migrations" (version) VALUES
('20261105030000'),
('20261105020000'),
('20261105010000'),
('20261105000100'),
('20261105000000'),
('20261104210000'),
('20261104190000'),
('20261104180100'),
('20261104180000'),
('20261104170300'),
('20261104170200'),
('20261104170100'),
('20261104170000');

