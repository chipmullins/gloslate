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
-- Name: payments fk_rails_2ffe474959; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT fk_rails_2ffe474959 FOREIGN KEY (household_id) REFERENCES public.households(id);


--
-- Name: payments fk_rails_872d859cfb; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT fk_rails_872d859cfb FOREIGN KEY (recorded_by_id) REFERENCES public.members(id);


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
('20261104170300'),
('20261104170200'),
('20261104170100'),
('20261104170000');

