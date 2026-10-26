using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DialectExchange.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddExchangeLikes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ExchangeLikes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ExchangeId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExchangeLikes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ExchangeLikes_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ExchangeLikes_Exchanges_ExchangeId",
                        column: x => x.ExchangeId,
                        principalTable: "Exchanges",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ExchangeLikes_ExchangeId",
                table: "ExchangeLikes",
                column: "ExchangeId");

            migrationBuilder.CreateIndex(
                name: "IX_ExchangeLikes_UserId_ExchangeId",
                table: "ExchangeLikes",
                columns: new[] { "UserId", "ExchangeId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ExchangeLikes");
        }
    }
}
