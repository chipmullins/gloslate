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
    CONSTRAINT move_dates_order CHECK (((moved_out_on IS NULL) OR (moved_in_on IS NULL) OR (moved_out_on >= moved_in_on)))
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
    updated_at timestamp(6) without time zone NOT NULL
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
-- Name: payment_allocations payment_allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_allocations
    ADD CONSTRAINT payment_allocations_pkey PRIMARY KEY (id);


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
-- Name: index_payment_allocations_on_expense_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_payment_allocations_on_expense_id ON public.payment_allocations USING btree (expense_id);


--
-- Name: index_payment_allocations_on_payment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_payment_allocations_on_payment_id ON public.payment_allocations USING btree (payment_id);


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
-- Name: identities fk_rails_5373344100; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.identities
    ADD CONSTRAINT fk_rails_5373344100 FOREIGN KEY (user_id) REFERENCES public.users(id);


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
-- Name: staff_sessions fk_rails_999e6e7559; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_sessions
    ADD CONSTRAINT fk_rails_999e6e7559 FOREIGN KEY (staff_user_id) REFERENCES public.staff_users(id);


--
-- Name: ledger_events fk_rails_9cf3b80290; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ledger_events
    ADD CONSTRAINT fk_rails_9cf3b80290 FOREIGN KEY (household_id) REFERENCES public.households(id);


--
-- Name: payments fk_rails_ad7b600208; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT fk_rails_ad7b600208 FOREIGN KEY (from_member_id) REFERENCES public.members(id);


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
('20261104180100'),
('20261104180000'),
('20261104170300'),
('20261104170200'),
('20261104170100'),
('20261104170000');

