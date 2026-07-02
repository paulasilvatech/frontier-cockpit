using './main.bicep'

param location = 'eastus'
param workload = 'agentobs'
param environmentName = 'prod'
param regionAbbr = 'eus'
param instance = '001'
param collectorBearerToken = readEnvironmentVariable('AZURE_OTLP_TOKEN')
param collectorMinReplicas = 2
param collectorMaxReplicas = 5
