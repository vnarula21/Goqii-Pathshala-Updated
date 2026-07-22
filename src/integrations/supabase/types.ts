export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      ai_usage_log: {
        Row: {
          ai_type: string
          cost_estimate: number | null
          created_at: string
          id: string
          metadata: Json | null
          model: string | null
          operation: string | null
          provider: string
          tokens_input: number | null
          tokens_output: number | null
          tokens_total: number | null
          user_id: string
        }
        Insert: {
          ai_type?: string
          cost_estimate?: number | null
          created_at?: string
          id?: string
          metadata?: Json | null
          model?: string | null
          operation?: string | null
          provider: string
          tokens_input?: number | null
          tokens_output?: number | null
          tokens_total?: number | null
          user_id: string
        }
        Update: {
          ai_type?: string
          cost_estimate?: number | null
          created_at?: string
          id?: string
          metadata?: Json | null
          model?: string | null
          operation?: string | null
          provider?: string
          tokens_input?: number | null
          tokens_output?: number | null
          tokens_total?: number | null
          user_id?: string
        }
        Relationships: []
      }
      api_key_vault: {
        Row: {
          api_key_encrypted: string
          created_at: string | null
          id: string
          provider: string
          secret_name: string
          updated_at: string | null
        }
        Insert: {
          api_key_encrypted: string
          created_at?: string | null
          id?: string
          provider: string
          secret_name: string
          updated_at?: string | null
        }
        Update: {
          api_key_encrypted?: string
          created_at?: string | null
          id?: string
          provider?: string
          secret_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      assessment_submissions: {
        Row: {
          assessment_id: string
          course_id: string
          created_at: string
          graded_at: string | null
          graded_by: string | null
          id: string
          manager_comments: string | null
          max_score: number
          response_text: string | null
          score: number | null
          status: Database["public"]["Enums"]["assessment_status"]
          submitted_at: string | null
          submitted_files: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          assessment_id: string
          course_id: string
          created_at?: string
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          manager_comments?: string | null
          max_score?: number
          response_text?: string | null
          score?: number | null
          status?: Database["public"]["Enums"]["assessment_status"]
          submitted_at?: string | null
          submitted_files?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          assessment_id?: string
          course_id?: string
          created_at?: string
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          manager_comments?: string | null
          max_score?: number
          response_text?: string | null
          score?: number | null
          status?: Database["public"]["Enums"]["assessment_status"]
          submitted_at?: string | null
          submitted_files?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_submissions_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_submissions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_submissions_graded_by_fkey"
            columns: ["graded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_submissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assessments: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          instructions: string | null
          max_score: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          instructions?: string | null
          max_score?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          instructions?: string | null
          max_score?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      badges: {
        Row: {
          category: string
          color: string
          created_at: string | null
          criteria: Json
          description: string | null
          icon: string
          id: string
          is_active: boolean | null
          name: string
          xp_reward: number | null
        }
        Insert: {
          category: string
          color?: string
          created_at?: string | null
          criteria?: Json
          description?: string | null
          icon?: string
          id?: string
          is_active?: boolean | null
          name: string
          xp_reward?: number | null
        }
        Update: {
          category?: string
          color?: string
          created_at?: string | null
          criteria?: Json
          description?: string | null
          icon?: string
          id?: string
          is_active?: boolean | null
          name?: string
          xp_reward?: number | null
        }
        Relationships: []
      }
      certificates: {
        Row: {
          course_id: string
          created_at: string | null
          id: string
          is_enabled: boolean | null
          min_passing_score: number | null
          template_config: Json | null
          template_name: string | null
          updated_at: string | null
          validity_months: number | null
        }
        Insert: {
          course_id: string
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          min_passing_score?: number | null
          template_config?: Json | null
          template_name?: string | null
          updated_at?: string | null
          validity_months?: number | null
        }
        Update: {
          course_id?: string
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          min_passing_score?: number | null
          template_config?: Json | null
          template_name?: string | null
          updated_at?: string | null
          validity_months?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "certificates_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: true
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_assessments: {
        Row: {
          assessment_id: string
          course_id: string
          created_at: string
          due_date: string | null
          due_days_after_start: number | null
          id: string
          order_index: number
        }
        Insert: {
          assessment_id: string
          course_id: string
          created_at?: string
          due_date?: string | null
          due_days_after_start?: number | null
          id?: string
          order_index?: number
        }
        Update: {
          assessment_id?: string
          course_id?: string
          created_at?: string
          due_date?: string | null
          due_days_after_start?: number | null
          id?: string
          order_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "course_assessments_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_assessments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_assignments: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          course_id: string
          due_date: string | null
          id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          course_id: string
          due_date?: string | null
          id?: string
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          course_id?: string
          due_date?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_assignments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_group_items: {
        Row: {
          course_id: string
          created_at: string | null
          group_id: string
          id: string
          order_index: number | null
        }
        Insert: {
          course_id: string
          created_at?: string | null
          group_id: string
          id?: string
          order_index?: number | null
        }
        Update: {
          course_id?: string
          created_at?: string | null
          group_id?: string
          id?: string
          order_index?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "course_group_items_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_group_items_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "course_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      course_groups: {
        Row: {
          created_at: string | null
          created_by: string
          description: string | null
          id: string
          name: string
          organization_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          description?: string | null
          id?: string
          name: string
          organization_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_groups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      course_modules: {
        Row: {
          course_id: string
          created_at: string
          id: string
          module_id: string
          order_index: number
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          module_id: string
          order_index?: number
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          module_id?: string
          order_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "course_modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_modules_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      course_progress: {
        Row: {
          completed_at: string | null
          course_id: string
          id: string
          is_completed: boolean
          module_scores: Json
          overall_score: number | null
          started_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          course_id: string
          id?: string
          is_completed?: boolean
          module_scores?: Json
          overall_score?: number | null
          started_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          course_id?: string
          id?: string
          is_completed?: boolean
          module_scores?: Json
          overall_score?: number | null
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_progress_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          completion_days: number | null
          created_at: string
          description: string | null
          id: string
          is_published: boolean
          level_id: string | null
          passing_score: number
          thumbnail_url: string | null
          title: string
          updated_at: string
          user_id: string
          visibility: string
        }
        Insert: {
          completion_days?: number | null
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          level_id?: string | null
          passing_score?: number
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          user_id: string
          visibility?: string
        }
        Update: {
          completion_days?: number | null
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          level_id?: string | null
          passing_score?: number
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_ai_providers: {
        Row: {
          ai_type: string
          api_endpoint: string
          api_key_header: string | null
          api_key_prefix: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          models: Json | null
          name: string
          provider_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_type?: string
          api_endpoint: string
          api_key_header?: string | null
          api_key_prefix?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          models?: Json | null
          name: string
          provider_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_type?: string
          api_endpoint?: string
          api_key_header?: string | null
          api_key_prefix?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          models?: Json | null
          name?: string
          provider_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      explain_mode_content: {
        Row: {
          created_at: string
          id: string
          module_id: string
          scenes: Json
          total_duration: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          module_id: string
          scenes?: Json
          total_duration?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          module_id?: string
          scenes?: Json
          total_duration?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "explain_mode_content_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      levels: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          display_name: string
          id: string
          name: string
          order_index: number
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          display_name: string
          id?: string
          name: string
          order_index?: number
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          display_name?: string
          id?: string
          name?: string
          order_index?: number
        }
        Relationships: []
      }
      module_assignment_submissions: {
        Row: {
          course_id: string
          created_at: string
          graded_at: string | null
          graded_by: string | null
          id: string
          manager_comments: string | null
          max_score: number
          module_assignment_id: string
          module_id: string
          response_text: string | null
          score: number | null
          status: string
          submitted_at: string | null
          submitted_files: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          manager_comments?: string | null
          max_score?: number
          module_assignment_id: string
          module_id: string
          response_text?: string | null
          score?: number | null
          status?: string
          submitted_at?: string | null
          submitted_files?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          manager_comments?: string | null
          max_score?: number
          module_assignment_id?: string
          module_id?: string
          response_text?: string | null
          score?: number | null
          status?: string
          submitted_at?: string | null
          submitted_files?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      module_assignments: {
        Row: {
          created_at: string
          evaluation_criteria: Json | null
          expected_output: string | null
          goal: string | null
          id: string
          instructions: string | null
          module_id: string
          module_name: string
          order_index: number
          rubric: Json | null
          title: string
        }
        Insert: {
          created_at?: string
          evaluation_criteria?: Json | null
          expected_output?: string | null
          goal?: string | null
          id?: string
          instructions?: string | null
          module_id: string
          module_name: string
          order_index?: number
          rubric?: Json | null
          title: string
        }
        Update: {
          created_at?: string
          evaluation_criteria?: Json | null
          expected_output?: string | null
          goal?: string | null
          id?: string
          instructions?: string | null
          module_id?: string
          module_name?: string
          order_index?: number
          rubric?: Json | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_assignments_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      module_outputs: {
        Row: {
          content: Json
          created_at: string
          format_type: string
          id: string
          module_id: string
          preferences: Json | null
          provider_name: string | null
          status: string | null
          video_url: string | null
        }
        Insert: {
          content?: Json
          created_at?: string
          format_type: string
          id?: string
          module_id: string
          preferences?: Json | null
          provider_name?: string | null
          status?: string | null
          video_url?: string | null
        }
        Update: {
          content?: Json
          created_at?: string
          format_type?: string
          id?: string
          module_id?: string
          preferences?: Json | null
          provider_name?: string | null
          status?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "module_outputs_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      module_quizzes: {
        Row: {
          created_at: string
          id: string
          module_id: string
          module_name: string
          questions: Json
          quiz_ai_used: string | null
          settings: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          module_id: string
          module_name: string
          questions?: Json
          quiz_ai_used?: string | null
          settings?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          module_id?: string
          module_name?: string
          questions?: Json
          quiz_ai_used?: string | null
          settings?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_quizzes_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      module_responses: {
        Row: {
          created_at: string
          id: string
          module_id: string | null
          question_index: number
          question_text: string | null
          response_text: string
          started_at: string | null
          submitted_at: string
          time_spent_seconds: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          module_id?: string | null
          question_index: number
          question_text?: string | null
          response_text: string
          started_at?: string | null
          submitted_at?: string
          time_spent_seconds?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          module_id?: string | null
          question_index?: number
          question_text?: string | null
          response_text?: string
          started_at?: string | null
          submitted_at?: string
          time_spent_seconds?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_responses_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      module_slide_audio: {
        Row: {
          audio_duration: number | null
          audio_status: string
          audio_url: string | null
          created_at: string
          id: string
          module_id: string
          narration_text: string
          slide_number: number
          updated_at: string
          voice_id: string | null
        }
        Insert: {
          audio_duration?: number | null
          audio_status?: string
          audio_url?: string | null
          created_at?: string
          id?: string
          module_id: string
          narration_text: string
          slide_number: number
          updated_at?: string
          voice_id?: string | null
        }
        Update: {
          audio_duration?: number | null
          audio_status?: string
          audio_url?: string | null
          created_at?: string
          id?: string
          module_id?: string
          narration_text?: string
          slide_number?: number
          updated_at?: string
          voice_id?: string | null
        }
        Relationships: []
      }
      module_tags: {
        Row: {
          created_at: string
          id: string
          module_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          module_id: string
          tag_id: string
        }
        Update: {
          created_at?: string
          id?: string
          module_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_tags_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      module_versions: {
        Row: {
          change_summary: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          module_id: string
          slides: Json
          title: string
          version_number: number
        }
        Insert: {
          change_summary?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          module_id: string
          slides: Json
          title: string
          version_number?: number
        }
        Update: {
          change_summary?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          module_id?: string
          slides?: Json
          title?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "module_versions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          approval_status: string | null
          approved_prompt: string | null
          assignment_data: Json | null
          content_ai_used: string | null
          content_summary: Json | null
          created_at: string
          description: string | null
          file_url: string | null
          forge_inputs: Json | null
          forge_status: string | null
          formatted_output: Json | null
          id: string
          is_favorite: boolean
          is_published: boolean | null
          module_type: string
          quiz_ai_used: string | null
          quiz_data: Json | null
          raw_content: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          slides: Json
          submitted_by: string | null
          submitted_for_review_at: string | null
          thumbnail_url: string | null
          time_limit_minutes: number | null
          title: string
          updated_at: string
          user_id: string
          visibility: string
        }
        Insert: {
          approval_status?: string | null
          approved_prompt?: string | null
          assignment_data?: Json | null
          content_ai_used?: string | null
          content_summary?: Json | null
          created_at?: string
          description?: string | null
          file_url?: string | null
          forge_inputs?: Json | null
          forge_status?: string | null
          formatted_output?: Json | null
          id?: string
          is_favorite?: boolean
          is_published?: boolean | null
          module_type?: string
          quiz_ai_used?: string | null
          quiz_data?: Json | null
          raw_content?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          slides: Json
          submitted_by?: string | null
          submitted_for_review_at?: string | null
          thumbnail_url?: string | null
          time_limit_minutes?: number | null
          title: string
          updated_at?: string
          user_id: string
          visibility?: string
        }
        Update: {
          approval_status?: string | null
          approved_prompt?: string | null
          assignment_data?: Json | null
          content_ai_used?: string | null
          content_summary?: Json | null
          created_at?: string
          description?: string | null
          file_url?: string | null
          forge_inputs?: Json | null
          forge_status?: string | null
          formatted_output?: Json | null
          id?: string
          is_favorite?: boolean
          is_published?: boolean | null
          module_type?: string
          quiz_ai_used?: string | null
          quiz_data?: Json | null
          raw_content?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          slides?: Json
          submitted_by?: string | null
          submitted_for_review_at?: string | null
          thumbnail_url?: string | null
          time_limit_minutes?: number | null
          title?: string
          updated_at?: string
          user_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "modules_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          metadata: Json | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          metadata?: Json | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          metadata?: Json | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_assignment_settings: {
        Row: {
          assignment_index: number
          created_at: string | null
          id: string
          is_enabled: boolean | null
          module_id: string
          organization_id: string
          updated_at: string | null
        }
        Insert: {
          assignment_index: number
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          module_id: string
          organization_id: string
          updated_at?: string | null
        }
        Update: {
          assignment_index?: number
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          module_id?: string
          organization_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_assignment_settings_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_assignment_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_course_settings: {
        Row: {
          course_id: string
          created_at: string | null
          disabled_assignment_indices: number[] | null
          id: string
          is_module_enabled: boolean | null
          module_id: string
          organization_id: string
          updated_at: string | null
        }
        Insert: {
          course_id: string
          created_at?: string | null
          disabled_assignment_indices?: number[] | null
          id?: string
          is_module_enabled?: boolean | null
          module_id: string
          organization_id: string
          updated_at?: string | null
        }
        Update: {
          course_id?: string
          created_at?: string | null
          disabled_assignment_indices?: number[] | null
          id?: string
          is_module_enabled?: boolean | null
          module_id?: string
          organization_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_course_settings_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_course_settings_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_course_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          access_type: string
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          access_type?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          access_type?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_active: boolean | null
          must_change_password: boolean
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          is_active?: boolean | null
          must_change_password?: boolean
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          must_change_password?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      system_ai_settings: {
        Row: {
          ai_mode: string
          id: string
          model: string | null
          narration_ai_mode: string
          narration_ai_model: string | null
          narration_ai_provider: string | null
          provider: string | null
          quiz_ai_mode: string
          quiz_ai_model: string | null
          quiz_ai_provider: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          ai_mode?: string
          id?: string
          model?: string | null
          narration_ai_mode?: string
          narration_ai_model?: string | null
          narration_ai_provider?: string | null
          provider?: string | null
          quiz_ai_mode?: string
          quiz_ai_model?: string | null
          quiz_ai_provider?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          ai_mode?: string
          id?: string
          model?: string | null
          narration_ai_mode?: string
          narration_ai_model?: string | null
          narration_ai_provider?: string | null
          provider?: string | null
          quiz_ai_mode?: string
          quiz_ai_model?: string | null
          quiz_ai_provider?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      tags: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_ai_settings: {
        Row: {
          ai_mode: string
          ai_mode_unified: string | null
          created_at: string | null
          id: string
          model_preference: string | null
          model_unified: string | null
          provider: string | null
          provider_unified: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ai_mode?: string
          ai_mode_unified?: string | null
          created_at?: string | null
          id?: string
          model_preference?: string | null
          model_unified?: string | null
          provider?: string | null
          provider_unified?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ai_mode?: string
          ai_mode_unified?: string | null
          created_at?: string | null
          id?: string
          model_preference?: string | null
          model_unified?: string | null
          provider?: string | null
          provider_unified?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          badge_id: string
          earned_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          badge_id: string
          earned_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          badge_id?: string
          earned_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
        ]
      }
      user_certificates: {
        Row: {
          certificate_id: string | null
          course_id: string
          expires_at: string | null
          id: string
          issued_at: string | null
          pdf_url: string | null
          score: number
          user_id: string
          verification_code: string
        }
        Insert: {
          certificate_id?: string | null
          course_id: string
          expires_at?: string | null
          id?: string
          issued_at?: string | null
          pdf_url?: string | null
          score: number
          user_id: string
          verification_code: string
        }
        Update: {
          certificate_id?: string | null
          course_id?: string
          expires_at?: string | null
          id?: string
          issued_at?: string | null
          pdf_url?: string | null
          score?: number
          user_id?: string
          verification_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_certificates_certificate_id_fkey"
            columns: ["certificate_id"]
            isOneToOne: false
            referencedRelation: "certificates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_certificates_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_organizations: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          id: string
          organization_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          id?: string
          organization_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          id?: string
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_organizations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_streaks: {
        Row: {
          created_at: string | null
          current_streak: number | null
          freeze_available: boolean | null
          freeze_used_this_week: string | null
          id: string
          last_activity_date: string | null
          longest_streak: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          current_streak?: number | null
          freeze_available?: boolean | null
          freeze_used_this_week?: string | null
          id?: string
          last_activity_date?: string | null
          longest_streak?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          current_streak?: number | null
          freeze_available?: boolean | null
          freeze_used_this_week?: string | null
          id?: string
          last_activity_date?: string | null
          longest_streak?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_xp: {
        Row: {
          created_at: string | null
          current_level: number | null
          id: string
          total_xp: number | null
          updated_at: string | null
          user_id: string
          week_start_date: string | null
          xp_this_week: number | null
        }
        Insert: {
          created_at?: string | null
          current_level?: number | null
          id?: string
          total_xp?: number | null
          updated_at?: string | null
          user_id: string
          week_start_date?: string | null
          xp_this_week?: number | null
        }
        Update: {
          created_at?: string | null
          current_level?: number | null
          id?: string
          total_xp?: number | null
          updated_at?: string | null
          user_id?: string
          week_start_date?: string | null
          xp_this_week?: number | null
        }
        Relationships: []
      }
      video_generation_jobs: {
        Row: {
          created_at: string
          current_step: string | null
          error_message: string | null
          id: string
          module_id: string
          output_video_url: string | null
          progress: number
          scene_completed: number
          scene_total: number
          shotstack_render_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_step?: string | null
          error_message?: string | null
          id?: string
          module_id: string
          output_video_url?: string | null
          progress?: number
          scene_completed?: number
          scene_total?: number
          shotstack_render_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_step?: string | null
          error_message?: string | null
          id?: string
          module_id?: string
          output_video_url?: string | null
          progress?: number
          scene_completed?: number
          scene_total?: number
          shotstack_render_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      video_provider_settings: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          provider_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          provider_name?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          provider_name?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      user_has_organization: {
        Args: { _organization_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "learner" | "manager" | "sme" | "admin" | "sme_expert"
      assessment_status:
        | "not_submitted"
        | "submitted"
        | "graded"
        | "needs_revision"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["learner", "manager", "sme", "admin", "sme_expert"],
      assessment_status: [
        "not_submitted",
        "submitted",
        "graded",
        "needs_revision",
      ],
    },
  },
} as const
