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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      class_members: {
        Row: {
          class_id: string
          created_at: string
          id: string
          student_name: string
          student_number: number | null
          student_user_id: string | null
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          student_name: string
          student_number?: number | null
          student_user_id?: string | null
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          student_name?: string
          student_number?: number | null
          student_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "class_members_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          teacher_user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          teacher_user_id?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          teacher_user_id?: string
        }
        Relationships: []
      }
      diagnostic_responses: {
        Row: {
          answers: Json
          completed_at: string | null
          id: string
          lesson_id: string
          student_user_id: string
          updated_at: string
        }
        Insert: {
          answers?: Json
          completed_at?: string | null
          id?: string
          lesson_id: string
          student_user_id?: string
          updated_at?: string
        }
        Update: {
          answers?: Json
          completed_at?: string | null
          id?: string
          lesson_id?: string
          student_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "diagnostic_responses_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lesson_problem_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_pairings: {
        Row: {
          generated_at: string
          helps_with: number[]
          id: string
          lesson_id: string
          partner_helps_with: number[]
          partner_name: string
          partner_student_number: number | null
          partner_user_id: string
          score: number
          student_user_id: string
        }
        Insert: {
          generated_at?: string
          helps_with?: number[]
          id?: string
          lesson_id: string
          partner_helps_with?: number[]
          partner_name: string
          partner_student_number?: number | null
          partner_user_id: string
          score?: number
          student_user_id: string
        }
        Update: {
          generated_at?: string
          helps_with?: number[]
          id?: string
          lesson_id?: string
          partner_helps_with?: number[]
          partner_name?: string
          partner_student_number?: number | null
          partner_user_id?: string
          score?: number
          student_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_pairings_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lesson_settings"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_post_activity_responses: {
        Row: {
          answers: Json
          completed_at: string | null
          created_at: string
          id: string
          lesson_id: string
          reflection: string
          student_user_id: string
          updated_at: string
        }
        Insert: {
          answers?: Json
          completed_at?: string | null
          created_at?: string
          id?: string
          lesson_id: string
          reflection?: string
          student_user_id?: string
          updated_at?: string
        }
        Update: {
          answers?: Json
          completed_at?: string | null
          created_at?: string
          id?: string
          lesson_id?: string
          reflection?: string
          student_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_post_activity_responses_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lesson_settings"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_problem_sets: {
        Row: {
          class_id: string
          created_at: string
          created_by: string
          id: string
          learning_date: string
          problem_numbers: number[]
          subject: string
          unit_name: string
        }
        Insert: {
          class_id: string
          created_at?: string
          created_by?: string
          id?: string
          learning_date: string
          problem_numbers?: number[]
          subject?: string
          unit_name: string
        }
        Update: {
          class_id?: string
          created_at?: string
          created_by?: string
          id?: string
          learning_date?: string
          problem_numbers?: number[]
          subject?: string
          unit_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_problem_sets_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_question_responses: {
        Row: {
          answers: Json
          completed_at: string | null
          created_at: string
          id: string
          lesson_id: string
          student_user_id: string
          updated_at: string
        }
        Insert: {
          answers?: Json
          completed_at?: string | null
          created_at?: string
          id?: string
          lesson_id: string
          student_user_id?: string
          updated_at?: string
        }
        Update: {
          answers?: Json
          completed_at?: string | null
          created_at?: string
          id?: string
          lesson_id?: string
          student_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_question_responses_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lesson_settings"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_settings: {
        Row: {
          class_number: number
          created_at: string
          grade: number
          id: string
          learning_date: string
          learning_time: string
          question_count: number
          questions: Json
          subject: string
          teacher_user_id: string
          updated_at: string
        }
        Insert: {
          class_number: number
          created_at?: string
          grade: number
          id?: string
          learning_date: string
          learning_time: string
          question_count: number
          questions?: Json
          subject?: string
          teacher_user_id?: string
          updated_at?: string
        }
        Update: {
          class_number?: number
          created_at?: string
          grade?: number
          id?: string
          learning_date?: string
          learning_time?: string
          question_count?: number
          questions?: Json
          subject?: string
          teacher_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      lesson_student_feedback: {
        Row: {
          created_at: string
          feedback: string
          id: string
          lesson_id: string
          source: string
          student_user_id: string
          teacher_user_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          feedback: string
          id?: string
          lesson_id: string
          source?: string
          student_user_id: string
          teacher_user_id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          feedback?: string
          id?: string
          lesson_id?: string
          source?: string
          student_user_id?: string
          teacher_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_student_feedback_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lesson_settings"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          class_code: string
          class_number: number | null
          created_at: string
          display_name: string
          grade: number | null
          role: string
          student_number: number | null
          subject: string | null
          subjects: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          class_code: string
          class_number?: number | null
          created_at?: string
          display_name: string
          grade?: number | null
          role: string
          student_number?: number | null
          subject?: string | null
          subjects?: string[]
          updated_at?: string
          user_id?: string
        }
        Update: {
          class_code?: string
          class_number?: number | null
          created_at?: string
          display_name?: string
          grade?: number | null
          role?: string
          student_number?: number | null
          subject?: string | null
          subjects?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      teacher_owns_lesson: {
        Args: { target_lesson_id: string }
        Returns: boolean
      }
      teacher_owns_lesson_class: {
        Args: { target_class_number: number; target_grade: number }
        Returns: boolean
      }
      teacher_update_student_profile:
        | {
            Args: {
              target_class_number: number
              target_display_name: string
              target_grade: number
              target_student_number: number
              target_subject: string
              target_user_id: string
            }
            Returns: {
              class_number: number
              display_name: string
              grade: number
              student_number: number
              subject: string
              updated_at: string
              user_id: string
            }[]
          }
        | {
            Args: {
              target_class_number: number
              target_display_name: string
              target_grade: number
              target_student_number: number
              target_subject: string
              target_subjects: string[]
              target_user_id: string
            }
            Returns: {
              class_number: number
              display_name: string
              grade: number
              student_number: number
              subject: string
              subjects: string[]
              updated_at: string
              user_id: string
            }[]
          }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
