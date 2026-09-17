/**
 * Generated from the live schema. Do not edit by hand.
 *
 * Regenerate after any migration with:
 *   npx supabase gen types typescript --project-id <ref> > src/lib/supabase/database.types.ts
 *
 * Note that the `app` schema (RLS helper functions, the PDPA erasure path) is
 * deliberately absent: PostgREST does not expose it, which is the point.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      ctf_challenges: {
        Row: {
          category: "web" | "crypto" | "forensics" | "misc";
          created_at: string;
          explanation_md: string;
          file_path: string | null;
          flag_hash: string;
          hints: Json;
          id: string;
          is_active: boolean;
          points: number;
          prompt_md: string;
          slug: string;
          sort_order: number;
          title: string;
        };
        Insert: {
          category: "web" | "crypto" | "forensics" | "misc";
          created_at?: string;
          explanation_md?: string;
          file_path?: string | null;
          flag_hash: string;
          hints?: Json;
          id?: string;
          is_active?: boolean;
          points: number;
          prompt_md: string;
          slug: string;
          sort_order?: number;
          title: string;
        };
        Update: Partial<Database["public"]["Tables"]["ctf_challenges"]["Insert"]>;
        Relationships: [];
      };
      ctf_event: {
        Row: {
          ends_at: string;
          id: number;
          is_active: boolean;
          passcode_hash: string | null;
          starts_at: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          ends_at: string;
          id?: number;
          is_active?: boolean;
          passcode_hash?: string | null;
          starts_at: string;
          title?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ctf_event"]["Insert"]>;
        Relationships: [];
      };
      ctf_hint_reveals: {
        Row: { challenge_id: string; hint_index: number; id: number; player_id: string; revealed_at: string };
        Insert: { challenge_id: string; hint_index: number; player_id: string; revealed_at?: string };
        Update: Partial<Database["public"]["Tables"]["ctf_hint_reveals"]["Insert"]>;
        Relationships: [];
      };
      ctf_players: {
        Row: {
          created_at: string;
          handle: string;
          id: string;
          passcode_hash: string | null;
          team_name: string | null;
          token_hash: string;
        };
        Insert: {
          created_at?: string;
          handle: string;
          id?: string;
          passcode_hash?: string | null;
          team_name?: string | null;
          token_hash: string;
        };
        Update: Partial<Database["public"]["Tables"]["ctf_players"]["Insert"]>;
        Relationships: [];
      };
      ctf_site_secrets: {
        Row: { key: string; value: string };
        Insert: { key: string; value: string };
        Update: { key?: string; value?: string };
        Relationships: [];
      };
      ctf_submissions: {
        Row: {
          challenge_id: string;
          created_at: string;
          id: number;
          is_correct: boolean;
          player_id: string;
          submitted_value: string;
        };
        Insert: {
          challenge_id: string;
          created_at?: string;
          is_correct: boolean;
          player_id: string;
          submitted_value: string;
        };
        Update: Partial<Database["public"]["Tables"]["ctf_submissions"]["Insert"]>;
        Relationships: [];
      };
      assignments: {
        Row: {
          assigned_by: string;
          cohort: string | null;
          created_at: string;
          due_at: string | null;
          id: string;
          org_id: string;
          scenario_id: string;
        };
        Insert: {
          assigned_by: string;
          cohort?: string | null;
          created_at?: string;
          due_at?: string | null;
          id?: string;
          org_id: string;
          scenario_id: string;
        };
        Update: {
          assigned_by?: string;
          cohort?: string | null;
          created_at?: string;
          due_at?: string | null;
          id?: string;
          org_id?: string;
          scenario_id?: string;
        };
        Relationships: [];
      };
      badges: {
        Row: { criteria: Json; description: string; id: string; key: string; name: string };
        Insert: { criteria?: Json; description: string; id?: string; key: string; name: string };
        Update: { criteria?: Json; description?: string; id?: string; key?: string; name?: string };
        Relationships: [];
      };
      data_erasures: {
        Row: {
          events_purged: number;
          id: string;
          org_id: string | null;
          purged_at: string;
          reason: string;
          requested_by: string;
          sessions_purged: number;
          subject_handle: string;
        };
        Insert: {
          events_purged: number;
          id?: string;
          org_id?: string | null;
          purged_at?: string;
          reason: string;
          requested_by: string;
          sessions_purged: number;
          subject_handle: string;
        };
        Update: {
          events_purged?: number;
          id?: string;
          org_id?: string | null;
          purged_at?: string;
          reason?: string;
          requested_by?: string;
          sessions_purged?: number;
          subject_handle?: string;
        };
        Relationships: [];
      };
      findings: {
        Row: {
          created_at: string;
          id: string;
          is_correct: boolean | null;
          kind: Database["public"]["Enums"]["finding_kind"];
          phase: Database["public"]["Enums"]["phase_key"];
          session_id: string;
          value: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_correct?: boolean | null;
          kind: Database["public"]["Enums"]["finding_kind"];
          phase: Database["public"]["Enums"]["phase_key"];
          session_id: string;
          value: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_correct?: boolean | null;
          kind?: Database["public"]["Enums"]["finding_kind"];
          phase?: Database["public"]["Enums"]["phase_key"];
          session_id?: string;
          value?: string;
        };
        Relationships: [];
      };
      instructor_comments: {
        Row: {
          comment: string;
          created_at: string;
          id: string;
          instructor_id: string;
          phase: Database["public"]["Enums"]["phase_key"] | null;
          session_id: string;
        };
        Insert: {
          comment: string;
          created_at?: string;
          id?: string;
          instructor_id: string;
          phase?: Database["public"]["Enums"]["phase_key"] | null;
          session_id: string;
        };
        Update: {
          comment?: string;
          created_at?: string;
          id?: string;
          instructor_id?: string;
          phase?: Database["public"]["Enums"]["phase_key"] | null;
          session_id?: string;
        };
        Relationships: [];
      };
      mitre_techniques: {
        Row: {
          description: string;
          id: string;
          is_subtechnique: boolean;
          name: string;
          parent_id: string | null;
          tactic: string;
          tactic_id: string;
          technique_id: string;
          url: string;
        };
        Insert: {
          description?: string;
          id?: string;
          is_subtechnique?: boolean;
          name: string;
          parent_id?: string | null;
          tactic: string;
          tactic_id: string;
          technique_id: string;
          url: string;
        };
        Update: {
          description?: string;
          id?: string;
          is_subtechnique?: boolean;
          name?: string;
          parent_id?: string | null;
          tactic?: string;
          tactic_id?: string;
          technique_id?: string;
          url?: string;
        };
        Relationships: [];
      };
      onboarding_results: {
        Row: { answers: Json; completed_at: string; max_score: number; score: number; user_id: string };
        Insert: { answers?: Json; completed_at?: string; max_score: number; score: number; user_id: string };
        Update: { answers?: Json; completed_at?: string; max_score?: number; score?: number; user_id?: string };
        Relationships: [];
      };
      organizations: {
        Row: {
          created_at: string;
          id: string;
          join_code: string;
          kind: Database["public"]["Enums"]["org_kind"];
          leaderboard_enabled: boolean;
          name: string;
          self_signup: boolean;
        };
        Insert: {
          created_at?: string;
          id?: string;
          join_code?: string;
          kind?: Database["public"]["Enums"]["org_kind"];
          leaderboard_enabled?: boolean;
          name: string;
          self_signup?: boolean;
        };
        Update: {
          created_at?: string;
          id?: string;
          join_code?: string;
          kind?: Database["public"]["Enums"]["org_kind"];
          leaderboard_enabled?: boolean;
          name?: string;
          self_signup?: boolean;
        };
        Relationships: [];
      };
      owasp_categories: {
        Row: {
          code: string;
          description: string;
          name: string;
          plain_language: string;
          short_name: string;
          url: string;
        };
        Insert: {
          code: string;
          description: string;
          name: string;
          plain_language: string;
          short_name: string;
          url: string;
        };
        Update: {
          code?: string;
          description?: string;
          name?: string;
          plain_language?: string;
          short_name?: string;
          url?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          cohort: string | null;
          created_at: string;
          display_name: string;
          handle: string;
          id: string;
          onboarding_completed_at: string | null;
          org_id: string;
          role: Database["public"]["Enums"]["user_role"];
        };
        Insert: {
          cohort?: string | null;
          created_at?: string;
          display_name: string;
          handle: string;
          id: string;
          onboarding_completed_at?: string | null;
          org_id: string;
          role?: Database["public"]["Enums"]["user_role"];
        };
        Update: {
          cohort?: string | null;
          created_at?: string;
          display_name?: string;
          handle?: string;
          id?: string;
          onboarding_completed_at?: string | null;
          org_id?: string;
          role?: Database["public"]["Enums"]["user_role"];
        };
        Relationships: [];
      };
      reports: {
        Row: {
          body_md: string | null;
          chain_head_hash: string | null;
          format: Database["public"]["Enums"]["report_format"];
          generated_at: string;
          id: string;
          session_id: string;
          storage_path: string | null;
          summary: Json;
        };
        Insert: {
          body_md?: string | null;
          chain_head_hash?: string | null;
          format: Database["public"]["Enums"]["report_format"];
          generated_at?: string;
          id?: string;
          session_id: string;
          storage_path?: string | null;
          summary?: Json;
        };
        Update: {
          body_md?: string | null;
          chain_head_hash?: string | null;
          format?: Database["public"]["Enums"]["report_format"];
          generated_at?: string;
          id?: string;
          session_id?: string;
          storage_path?: string | null;
          summary?: Json;
        };
        Relationships: [];
      };
      scenario_assets: {
        Row: {
          asset_type: Database["public"]["Enums"]["asset_type"];
          content: Json;
          external_id: string;
          id: string;
          is_decoy: boolean;
          reveal_phase: Database["public"]["Enums"]["phase_key"];
          scenario_id: string;
        };
        Insert: {
          asset_type: Database["public"]["Enums"]["asset_type"];
          content: Json;
          external_id: string;
          id?: string;
          is_decoy?: boolean;
          reveal_phase?: Database["public"]["Enums"]["phase_key"];
          scenario_id: string;
        };
        Update: {
          asset_type?: Database["public"]["Enums"]["asset_type"];
          content?: Json;
          external_id?: string;
          id?: string;
          is_decoy?: boolean;
          reveal_phase?: Database["public"]["Enums"]["phase_key"];
          scenario_id?: string;
        };
        Relationships: [];
      };
      scenario_owasp_map: {
        Row: { owasp_code: string; scenario_id: string };
        Insert: { owasp_code: string; scenario_id: string };
        Update: { owasp_code?: string; scenario_id?: string };
        Relationships: [];
      };
      scenario_phases: {
        Row: {
          id: string;
          instructions_md: string;
          objectives: string[];
          order_index: number;
          phase_key: Database["public"]["Enums"]["phase_key"];
          scenario_id: string;
          spec: Json;
          success_criteria: Json;
          title: string;
        };
        Insert: {
          id?: string;
          instructions_md: string;
          objectives?: string[];
          order_index: number;
          phase_key: Database["public"]["Enums"]["phase_key"];
          scenario_id: string;
          spec: Json;
          success_criteria: Json;
          title: string;
        };
        Update: {
          id?: string;
          instructions_md?: string;
          objectives?: string[];
          order_index?: number;
          phase_key?: Database["public"]["Enums"]["phase_key"];
          scenario_id?: string;
          spec?: Json;
          success_criteria?: Json;
          title?: string;
        };
        Relationships: [];
      };
      scenario_technique_map: {
        Row: { scenario_id: string; technique_id: string };
        Insert: { scenario_id: string; technique_id: string };
        Update: { scenario_id?: string; technique_id?: string };
        Relationships: [];
      };
      scenarios: {
        Row: {
          briefing_md: string;
          category: Database["public"]["Enums"]["scenario_category"];
          continues_from: string | null;
          created_at: string;
          difficulty: Database["public"]["Enums"]["scenario_difficulty"];
          estimated_minutes: number;
          id: string;
          is_published: boolean;
          learning_objectives: string[];
          model_recommendations: string[];
          organization_name: string;
          root_cause: string;
          slug: string;
          summary: string;
          title: string;
        };
        Insert: {
          briefing_md: string;
          category: Database["public"]["Enums"]["scenario_category"];
          continues_from?: string | null;
          created_at?: string;
          difficulty: Database["public"]["Enums"]["scenario_difficulty"];
          estimated_minutes: number;
          id?: string;
          is_published?: boolean;
          learning_objectives?: string[];
          model_recommendations?: string[];
          organization_name: string;
          root_cause: string;
          slug: string;
          summary: string;
          title: string;
        };
        Update: {
          briefing_md?: string;
          category?: Database["public"]["Enums"]["scenario_category"];
          continues_from?: string | null;
          created_at?: string;
          difficulty?: Database["public"]["Enums"]["scenario_difficulty"];
          estimated_minutes?: number;
          id?: string;
          is_published?: boolean;
          learning_objectives?: string[];
          model_recommendations?: string[];
          organization_name?: string;
          root_cause?: string;
          slug?: string;
          summary?: string;
          title?: string;
        };
        Relationships: [];
      };
      session_badges: {
        Row: { badge_id: string; earned_at: string; session_id: string };
        Insert: { badge_id: string; earned_at?: string; session_id: string };
        Update: { badge_id?: string; earned_at?: string; session_id?: string };
        Relationships: [];
      };
      session_decisions: {
        Row: {
          created_at: string;
          decision_key: string;
          decision_value: Json;
          id: string;
          is_correct: boolean | null;
          phase: Database["public"]["Enums"]["phase_key"];
          rationale_md: string | null;
          session_id: string;
        };
        Insert: {
          created_at?: string;
          decision_key: string;
          decision_value: Json;
          id?: string;
          is_correct?: boolean | null;
          phase: Database["public"]["Enums"]["phase_key"];
          rationale_md?: string | null;
          session_id: string;
        };
        Update: {
          created_at?: string;
          decision_key?: string;
          decision_value?: Json;
          id?: string;
          is_correct?: boolean | null;
          phase?: Database["public"]["Enums"]["phase_key"];
          rationale_md?: string | null;
          session_id?: string;
        };
        Relationships: [];
      };
      session_events: {
        Row: {
          client_meta: Json | null;
          created_at: string;
          event_type: Database["public"]["Enums"]["event_type"];
          hash: string;
          id: string;
          payload: Json;
          phase: Database["public"]["Enums"]["phase_key"] | null;
          prev_hash: string;
          seq: number;
          session_id: string;
          user_id: string | null;
        };
        Insert: {
          client_meta?: Json | null;
          created_at?: string;
          event_type: Database["public"]["Enums"]["event_type"];
          hash: string;
          id?: string;
          payload?: Json;
          phase?: Database["public"]["Enums"]["phase_key"] | null;
          prev_hash?: string;
          seq?: never;
          session_id: string;
          user_id?: string | null;
        };
        Update: never;
        Relationships: [];
      };
      sessions: {
        Row: {
          adjusted_score: number | null;
          completed_at: string | null;
          created_at: string;
          current_phase: Database["public"]["Enums"]["phase_key"];
          id: string;
          is_sample: boolean;
          max_score: number | null;
          org_id: string;
          scenario_id: string;
          score: number | null;
          started_at: string;
          status: Database["public"]["Enums"]["session_status"];
          user_id: string;
        };
        Insert: {
          adjusted_score?: number | null;
          completed_at?: string | null;
          created_at?: string;
          current_phase?: Database["public"]["Enums"]["phase_key"];
          id?: string;
          is_sample?: boolean;
          max_score?: number | null;
          org_id: string;
          scenario_id: string;
          score?: number | null;
          started_at?: string;
          status?: Database["public"]["Enums"]["session_status"];
          user_id: string;
        };
        Update: {
          adjusted_score?: number | null;
          completed_at?: string | null;
          current_phase?: Database["public"]["Enums"]["phase_key"];
          max_score?: number | null;
          score?: number | null;
          status?: Database["public"]["Enums"]["session_status"];
        };
        Relationships: [];
      };
    };
    Views: {
      ctf_challenge_stats: {
        Row: {
          attempts: number;
          category: string;
          challenge_id: string;
          is_active: boolean;
          players: number;
          points: number;
          slug: string;
          solves: number;
          sort_order: number;
          title: string;
        };
        Relationships: [];
      };
      ctf_scoreboard: {
        Row: {
          created_at: string;
          handle: string;
          hint_cost: number;
          last_solve_at: string | null;
          player_id: string;
          score: number;
          solves: number;
          team_name: string | null;
        };
        Relationships: [];
      };
      leaderboard_entries: {
        Row: {
          cohort: string | null;
          completed_sessions: number | null;
          handle: string | null;
          last_completed_at: string | null;
          org_id: string | null;
          total_score: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      ctf_challenge_detail: { Args: { p_token: string; p_slug: string }; Returns: Json };
      ctf_event_info: { Args: Record<string, never>; Returns: Json };
      ctf_intranet_memo: { Args: Record<string, never>; Returns: string | null };
      ctf_join: { Args: { p_handle: string; p_team: string; p_passcode: string }; Returns: Json };
      ctf_note: { Args: { p_token: string; p_id: number }; Returns: Json };
      ctf_player_state: { Args: { p_token: string }; Returns: Json };
      ctf_public_scoreboard: { Args: Record<string, never>; Returns: Json };
      ctf_reveal_hint: { Args: { p_token: string; p_slug: string }; Returns: Json };
      ctf_submit: {
        Args: { p_token: string; p_slug: string; p_value: string; p_flag_hash: string };
        Returns: Json;
      };
      lookup_join_code: { Args: { p_code: string }; Returns: string };
      session_chain_head: { Args: { p_session_id: string }; Returns: string };
      verify_session_chain: {
        Args: { p_session_id: string };
        Returns: {
          broken_at_seq: number;
          event_count: number;
          head_hash: string;
          linkage_valid: boolean;
        }[];
      };
    };
    Enums: {
      asset_type:
        | "email"
        | "firewall_log"
        | "edr_alert"
        | "auth_log"
        | "dns_log"
        | "proxy_log"
        | "file_share_log"
        | "http_access_log"
        | "ransom_note"
        | "ticket";
      event_type:
        | "SESSION_START"
        | "SESSION_PAUSE"
        | "SESSION_RESUME"
        | "SESSION_COMPLETE"
        | "VIEW_ALERT"
        | "RUN_QUERY"
        | "VIEW_LOG_ENTRY"
        | "TAG_IOC"
        | "UNTAG_IOC"
        | "ADD_NOTE"
        | "SUBMIT_DECISION"
        | "REQUEST_HINT"
        | "PHASE_TRANSITION"
        | "CONTAIN_HOST"
        | "ISOLATE_ACCOUNT"
        | "BLOCK_INDICATOR"
        | "ESCALATE"
        | "DOWNLOAD_ARTIFACT"
        | "SUBMIT_REPORT"
        | "INSTRUCTOR_COMMENT"
        | "GRADE_ASSIGNED";
      finding_kind: "ioc" | "technique" | "root_cause";
      org_kind: "school" | "polytechnic" | "demo";
      phase_key:
        | "triage"
        | "investigation"
        | "containment"
        | "eradication"
        | "recovery"
        | "lessons_learned";
      report_format: "pdf" | "markdown";
      scenario_category: "phishing" | "network" | "web" | "ransomware" | "insider";
      scenario_difficulty: "beginner" | "intermediate" | "advanced";
      session_status: "in_progress" | "submitted" | "graded";
      user_role: "student" | "instructor" | "admin";
    };
    CompositeTypes: Record<never, never>;
  };
};

type PublicSchema = Database["public"];

export type Tables<T extends keyof (PublicSchema["Tables"] & PublicSchema["Views"])> =
  (PublicSchema["Tables"] & PublicSchema["Views"])[T] extends { Row: infer R } ? R : never;

export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T] extends { Insert: infer I } ? I : never;

export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T] extends { Update: infer U } ? U : never;

export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];
