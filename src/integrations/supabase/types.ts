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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      aps_calculation_rules: {
        Row: {
          code: string
          counting_subject_count: number | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          max_total_aps: number | null
          name: string
          sort_order: number
          source_url: string | null
          special_rules: Json
          status: Database["public"]["Enums"]["aps_rule_status"]
          updated_at: string
          version: string
        }
        Insert: {
          code: string
          counting_subject_count?: number | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          max_total_aps?: number | null
          name: string
          sort_order?: number
          source_url?: string | null
          special_rules?: Json
          status?: Database["public"]["Enums"]["aps_rule_status"]
          updated_at?: string
          version?: string
        }
        Update: {
          code?: string
          counting_subject_count?: number | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          max_total_aps?: number | null
          name?: string
          sort_order?: number
          source_url?: string | null
          special_rules?: Json
          status?: Database["public"]["Enums"]["aps_rule_status"]
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      aps_point_bands: {
        Row: {
          created_at: string
          id: string
          label: string | null
          max_percentage: number
          min_percentage: number
          points: number
          rule_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          max_percentage: number
          min_percentage: number
          points: number
          rule_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          max_percentage?: number
          min_percentage?: number
          points?: number
          rule_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aps_point_bands_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "aps_calculation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      aps_rule_subjects: {
        Row: {
          bonus_points: number | null
          created_at: string
          id: string
          max_points: number | null
          notes: string | null
          rule_id: string
          rule_type: Database["public"]["Enums"]["aps_subject_rule_type"]
          subject_id: string
          updated_at: string
        }
        Insert: {
          bonus_points?: number | null
          created_at?: string
          id?: string
          max_points?: number | null
          notes?: string | null
          rule_id: string
          rule_type: Database["public"]["Enums"]["aps_subject_rule_type"]
          subject_id: string
          updated_at?: string
        }
        Update: {
          bonus_points?: number | null
          created_at?: string
          id?: string
          max_points?: number | null
          notes?: string | null
          rule_id?: string
          rule_type?: Database["public"]["Enums"]["aps_subject_rule_type"]
          subject_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aps_rule_subjects_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "aps_calculation_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aps_rule_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      course_requirement_rules: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_required: boolean
          metadata: Json
          min_achievement_level: number | null
          min_aps: number | null
          min_count: number | null
          min_percentage: number | null
          requirement_set_id: string
          rule_type: Database["public"]["Enums"]["requirement_rule_type"]
          sort_order: number
          subject_id: string | null
          subject_ids: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_required?: boolean
          metadata?: Json
          min_achievement_level?: number | null
          min_aps?: number | null
          min_count?: number | null
          min_percentage?: number | null
          requirement_set_id: string
          rule_type: Database["public"]["Enums"]["requirement_rule_type"]
          sort_order?: number
          subject_id?: string | null
          subject_ids?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_required?: boolean
          metadata?: Json
          min_achievement_level?: number | null
          min_aps?: number | null
          min_count?: number | null
          min_percentage?: number | null
          requirement_set_id?: string
          rule_type?: Database["public"]["Enums"]["requirement_rule_type"]
          sort_order?: number
          subject_id?: string | null
          subject_ids?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_requirement_rules_requirement_set_id_fkey"
            columns: ["requirement_set_id"]
            isOneToOne: false
            referencedRelation: "course_requirement_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_requirement_rules_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      course_requirement_sets: {
        Row: {
          course_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          metadata: Json
          min_aps: number | null
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          min_aps?: number | null
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          min_aps?: number | null
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_requirement_sets_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          application_url: string | null
          aps_requirement: number | null
          code: string | null
          created_at: string
          description: string | null
          duration_years: number | null
          faculty_id: string | null
          id: string
          is_active: boolean
          is_demo: boolean
          metadata: Json
          name: string
          publication_status: Database["public"]["Enums"]["publication_status"]
          qualification_type_id: string | null
          sort_order: number
          university_id: string
          updated_at: string
        }
        Insert: {
          application_url?: string | null
          aps_requirement?: number | null
          code?: string | null
          created_at?: string
          description?: string | null
          duration_years?: number | null
          faculty_id?: string | null
          id?: string
          is_active?: boolean
          is_demo?: boolean
          metadata?: Json
          name: string
          publication_status?: Database["public"]["Enums"]["publication_status"]
          qualification_type_id?: string | null
          sort_order?: number
          university_id: string
          updated_at?: string
        }
        Update: {
          application_url?: string | null
          aps_requirement?: number | null
          code?: string | null
          created_at?: string
          description?: string | null
          duration_years?: number | null
          faculty_id?: string | null
          id?: string
          is_active?: boolean
          is_demo?: boolean
          metadata?: Json
          name?: string
          publication_status?: Database["public"]["Enums"]["publication_status"]
          qualification_type_id?: string | null
          sort_order?: number
          university_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_faculty_id_fkey"
            columns: ["faculty_id"]
            isOneToOne: false
            referencedRelation: "faculties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_qualification_type_id_fkey"
            columns: ["qualification_type_id"]
            isOneToOne: false
            referencedRelation: "qualification_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      faculties: {
        Row: {
          code: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          metadata: Json
          name: string
          publication_status: Database["public"]["Enums"]["publication_status"]
          sort_order: number
          university_id: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          name: string
          publication_status?: Database["public"]["Enums"]["publication_status"]
          sort_order?: number
          university_id: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          name?: string
          publication_status?: Database["public"]["Enums"]["publication_status"]
          sort_order?: number
          university_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "faculties_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          aps_tolerance: number
          created_at: string
          first_name: string | null
          id: string
          last_name: string | null
          onboarding_completed_at: string | null
          province_id: string | null
          subject_percentage_tolerance: number
          updated_at: string
        }
        Insert: {
          aps_tolerance?: number
          created_at?: string
          first_name?: string | null
          id: string
          last_name?: string | null
          onboarding_completed_at?: string | null
          province_id?: string | null
          subject_percentage_tolerance?: number
          updated_at?: string
        }
        Update: {
          aps_tolerance?: number
          created_at?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          onboarding_completed_at?: string | null
          province_id?: string | null
          subject_percentage_tolerance?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_province_id_fkey"
            columns: ["province_id"]
            isOneToOne: false
            referencedRelation: "provinces"
            referencedColumns: ["id"]
          },
        ]
      }
      provinces: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      qualification_types: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          nqf_level: number | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          nqf_level?: number | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          nqf_level?: number | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      saved_courses: {
        Row: {
          course_id: string
          created_at: string
          id: string
          notes: string | null
          profile_id: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          notes?: string | null
          profile_id: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_courses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_courses_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_subjects: {
        Row: {
          achievement_level: number | null
          created_at: string
          custom_subject_name: string | null
          id: string
          mark: number | null
          profile_id: string
          subject_id: string | null
          updated_at: string
        }
        Insert: {
          achievement_level?: number | null
          created_at?: string
          custom_subject_name?: string | null
          id?: string
          mark?: number | null
          profile_id: string
          subject_id?: string | null
          updated_at?: string
        }
        Update: {
          achievement_level?: number | null
          created_at?: string
          custom_subject_name?: string | null
          id?: string
          mark?: number | null
          profile_id?: string
          subject_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_subjects_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          category: string
          code: string
          created_at: string
          id: string
          is_designated: boolean
          name: string
          requirement_type: string
          sort_order: number
        }
        Insert: {
          category?: string
          code: string
          created_at?: string
          id?: string
          is_designated?: boolean
          name: string
          requirement_type?: string
          sort_order?: number
        }
        Update: {
          category?: string
          code?: string
          created_at?: string
          id?: string
          is_designated?: boolean
          name?: string
          requirement_type?: string
          sort_order?: number
        }
        Relationships: []
      }
      universities: {
        Row: {
          application_url: string | null
          aps_rule_id: string | null
          city: string | null
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_demo: boolean
          logo_url: string | null
          metadata: Json
          name: string
          province_id: string
          publication_status: Database["public"]["Enums"]["publication_status"]
          short_name: string | null
          sort_order: number
          updated_at: string
          website_url: string | null
        }
        Insert: {
          application_url?: string | null
          aps_rule_id?: string | null
          city?: string | null
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_demo?: boolean
          logo_url?: string | null
          metadata?: Json
          name: string
          province_id: string
          publication_status?: Database["public"]["Enums"]["publication_status"]
          short_name?: string | null
          sort_order?: number
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          application_url?: string | null
          aps_rule_id?: string | null
          city?: string | null
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_demo?: boolean
          logo_url?: string | null
          metadata?: Json
          name?: string
          province_id?: string
          publication_status?: Database["public"]["Enums"]["publication_status"]
          short_name?: string | null
          sort_order?: number
          updated_at?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "universities_aps_rule_id_fkey"
            columns: ["aps_rule_id"]
            isOneToOne: false
            referencedRelation: "aps_calculation_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "universities_province_id_fkey"
            columns: ["province_id"]
            isOneToOne: false
            referencedRelation: "provinces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      aps_rule_status: "demo" | "unverified" | "verified"
      aps_subject_rule_type:
        | "exclude"
        | "always_include"
        | "cap_points"
        | "bonus_points"
      publication_status: "draft" | "published"
      requirement_rule_type:
        | "min_aps"
        | "subject_min_percentage"
        | "subject_min_level"
        | "one_of_subjects_min_percentage"
        | "one_of_subjects_min_level"
        | "min_subject_count"
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
      app_role: ["admin", "moderator", "user"],
      aps_rule_status: ["demo", "unverified", "verified"],
      aps_subject_rule_type: [
        "exclude",
        "always_include",
        "cap_points",
        "bonus_points",
      ],
      publication_status: ["draft", "published"],
      requirement_rule_type: [
        "min_aps",
        "subject_min_percentage",
        "subject_min_level",
        "one_of_subjects_min_percentage",
        "one_of_subjects_min_level",
        "min_subject_count",
      ],
    },
  },
} as const
