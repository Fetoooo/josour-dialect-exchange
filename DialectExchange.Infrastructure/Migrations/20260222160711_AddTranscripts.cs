using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DialectExchange.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTranscripts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Transcripts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ExchangeId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Transcripts", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TranscriptWords",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TranscriptId = table.Column<Guid>(type: "uuid", nullable: false),
                    WordAr = table.Column<string>(type: "text", nullable: false),
                    WordStandard = table.Column<string>(type: "text", nullable: true),
                    ExplanationAr = table.Column<string>(type: "text", nullable: true),
                    StartTime = table.Column<double>(type: "double precision", nullable: false),
                    EndTime = table.Column<double>(type: "double precision", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TranscriptWords", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TranscriptWords_Transcripts_TranscriptId",
                        column: x => x.TranscriptId,
                        principalTable: "Transcripts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TranscriptWords_TranscriptId",
                table: "TranscriptWords",
                column: "TranscriptId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TranscriptWords");

            migrationBuilder.DropTable(
                name: "Transcripts");
        }
    }
}
