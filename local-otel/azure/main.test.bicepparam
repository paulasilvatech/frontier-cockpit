using './main.bicep'

param location = 'eastus'
param workload = 'agentobs'
param environmentName = 'test'
param regionAbbr = 'eus'
param instance = '001'
param collectorBearerToken = readEnvironmentVariable('AZURE_OTLP_TOKEN')
param collectorMinReplicas = 1
param collectorMaxReplicas = 3
