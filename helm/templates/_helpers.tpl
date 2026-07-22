{{/*
Expand the name of the chart.
*/}}
{{- define "virtual-team.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this.
*/}}
{{- define "virtual-team.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "virtual-team.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "virtual-team.labels" -}}
helm.sh/chart: {{ include "virtual-team.chart" . }}
{{ include "virtual-team.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "virtual-team.selectorLabels" -}}
app.kubernetes.io/name: {{ include "virtual-team.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Postgres service name
*/}}
{{- define "virtual-team.postgres.fullname" -}}
{{- printf "%s-postgres" (include "virtual-team.fullname" .) }}
{{- end }}

{{/*
Redis service name
*/}}
{{- define "virtual-team.redis.fullname" -}}
{{- printf "%s-redis" (include "virtual-team.fullname" .) }}
{{- end }}

{{/*
Backend service name
*/}}
{{- define "virtual-team.backend.fullname" -}}
{{- printf "%s-backend" (include "virtual-team.fullname" .) }}
{{- end }}

{{/*
Backend image
*/}}
{{- define "virtual-team.backend.image" -}}
{{- $registry := .Values.global.acrRegistry }}
{{- if .Values.backend.image.repository }}
{{- printf "%s:%s" .Values.backend.image.repository .Values.backend.image.tag }}
{{- else }}
{{- printf "%s/backend:%s" $registry .Values.backend.image.tag }}
{{- end }}
{{- end }}

{{/*
Frontend image
*/}}
{{- define "virtual-team.frontend.image" -}}
{{- $registry := .Values.global.acrRegistry }}
{{- if .Values.frontend.image.repository }}
{{- printf "%s:%s" .Values.frontend.image.repository .Values.frontend.image.tag }}
{{- else }}
{{- printf "%s/frontend:%s" $registry .Values.frontend.image.tag }}
{{- end }}
{{- end }}

{{/*
Database URL constructed from postgres values
*/}}
{{- define "virtual-team.databaseUrl" -}}
{{- $user := .Values.postgres.user }}
{{- $password := .Values.postgres.password }}
{{- $host := include "virtual-team.postgres.fullname" . }}
{{- $port := .Values.postgres.port | toString }}
{{- $db := .Values.postgres.db }}
{{- printf "postgresql+asyncpg://%s:%s@%s:%s/%s" $user $password $host $port $db }}
{{- end }}

{{/*
Redis URL
*/}}
{{- define "virtual-team.redisUrl" -}}
{{- $host := include "virtual-team.redis.fullname" . }}
{{- printf "redis://%s:6379/0" $host }}
{{- end }}

{{/*
Checkpointer DSN
*/}}
{{- define "virtual-team.checkpointerDsn" -}}
{{- $user := .Values.postgres.user }}
{{- $password := .Values.postgres.password }}
{{- $host := include "virtual-team.postgres.fullname" . }}
{{- $db := .Values.postgres.db }}
{{- printf "postgresql://%s:%s@%s:5432/%s" $user $password $host $db }}
{{- end }}
