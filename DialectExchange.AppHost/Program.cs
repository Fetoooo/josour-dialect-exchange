var builder = DistributedApplication.CreateBuilder(args);

var apiService = builder.AddProject<Projects.DialectExchange_ApiService>("apiservice");

builder.AddProject<Projects.DialectExchange_Web>("webfrontend")
    .WithExternalHttpEndpoints()
    .WithReference(apiService)
    .WaitFor(apiService);

builder.Build().Run();
