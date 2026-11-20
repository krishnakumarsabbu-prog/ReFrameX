       IDENTIFICATION DIVISION.
       PROGRAM-ID. COPYTEST.
       AUTHOR. REFRAMEX-SAMPLE.
      * Tests COPY with REPLACING and copybook in comment.
      *    COPY POLICY REPLACING ==POL-== BY ==P-==
       ENVIRONMENT DIVISION.
       DATA DIVISION.
       WORKING-STORAGE SECTION.
       01  WS-DATA.
           COPY POLICY REPLACING ==POL-== BY ==P-==.
       01  WS-STATUS          PIC X(2).
       PROCEDURE DIVISION.
       MAIN-PARA.
           STOP RUN.
