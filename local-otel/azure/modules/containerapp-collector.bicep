param location string
param name string
param tags object
param managedEnvironmentId string
param identityResourceId string
@secure()
param collectorBearerToken string
@secure()
param applicationInsightsConnectionString string
@secure()
param collectorConfig string
param image string = 'otel/opentelemetry-collector-contrib:0.155.0'
param minReplicas int = 1
param maxReplicas int = 3

resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: name
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${identityResourceId}': {}
    }
  }
  properties: {
    managedEnvironmentId: managedEnvironmentId
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 4318
        transport: 'http'
        allowInsecure: false
        traffic: [
          {
            latestRevision: true
            weight: 100
          }
        ]
      }
      secrets: [
        {
          name: 'collector-bearer-token'
          value: collectorBearerToken
        }
        {
          name: 'applicationinsights-connection-string'
          value: applicationInsightsConnectionString
        }
        {
          name: 'collector-config'
          value: collectorConfig
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'otel-collector'
          image: image
          args: [
            '--config=env:COLLECTOR_CONFIG'
          ]
          env: [
            {
              name: 'COLLECTOR_CONFIG'
              secretRef: 'collector-config'
            }
            {
              name: 'COLLECTOR_BEARER_TOKEN'
              secretRef: 'collector-bearer-token'
            }
            {
              name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
              secretRef: 'applicationinsights-connection-string'
            }
          ]
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
        }
      ]
      scale: {
        minReplicas: minReplicas
        maxReplicas: maxReplicas
      }
    }
  }
}

output id string = containerApp.id
output name string = containerApp.name
output fqdn string = containerApp.properties.configuration.ingress.fqdn
