       01  EMPLOYEE-RECORD.
           05  EMP-ID           PIC 9(6) COMP.
           05  EMP-NAME         PIC X(25).
           05  EMP-DEPT         PIC X(10).
           05  EMP-SALARY       PIC 9(7)V99 COMP-3.
           05  EMP-HIRE-DATE    PIC 9(8).
           05  EMP-PHONE        PIC X(12).
           05  EMP-ADDRESS      OCCURS 3 TIMES.
               10  ADDR-LINE    PIC X(40).
           05  EMP-STATUS       PIC X(1).
               88  EMP-ACTIVE  VALUE 'A'.
               88  EMP-RETIRED VALUE 'R'.
